// ============================================================
// Webhook Queue — Persistent PostgreSQL-backed queue
//
// Replaces the in-memory array that lost data on restart.
// Uses PostgreSQL FOR UPDATE SKIP LOCKED for safe concurrent
// job claiming across multiple API instances.
// ============================================================

import { createLogger } from "../../lib/logger.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { normalizeAndStore } from "./normalizer.js";
import { getProvider } from "./registry.js";
import { ensureFreshToken } from "./token-manager.js";
import type { ProviderName } from "./types.js";

const log = createLogger({ module: "webhook-queue" });

/** Delay between queue polling cycles (ms) */
const POLL_INTERVAL_MS = 3000;

/** Number of jobs to claim per poll cycle */
const BATCH_SIZE = 5;

/** Visibility timeout — if processing takes longer, job becomes visible again */
const VISIBILITY_TIMEOUT_SECONDS = 60;

/** Retry delay for failed jobs (seconds) */
const RETRY_DELAY_SECONDS = 10;

let pollIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Enqueue a webhook job for async processing.
 * Returns immediately — the webhook handler can respond 200.
 */
export async function enqueueWebhook(
	provider: ProviderName,
	event: Record<string, unknown>,
): Promise<void> {
	const admin = createAdminClient();

	const { error } = await admin.from("webhook_queue").insert({
		provider,
		event_data: event,
		status: "pending",
		attempts: 0,
		max_attempts: 3,
	});

	if (error) {
		log.error({ err: error, provider }, "Failed to enqueue webhook job");
		return;
	}

	log.info({ provider }, "Enqueued webhook job");

	// Auto-start polling if not already running
	ensurePolling();
}

/**
 * Start the queue poller if not already running.
 */
function ensurePolling(): void {
	if (pollIntervalId) return;

	log.info("Starting webhook queue poller");

	pollIntervalId = setInterval(async () => {
		try {
			await pollAndProcess();
		} catch (err) {
			log.error({ err }, "Queue poller error");
		}
	}, POLL_INTERVAL_MS);
}

/**
 * Poll for available jobs and process them.
 */
async function pollAndProcess(): Promise<void> {
	const admin = createAdminClient();

	// Claim a batch of jobs atomically
	const { data: jobs, error } = await admin.rpc("claim_webhook_jobs", {
		batch_size: BATCH_SIZE,
		visibility_timeout_seconds: VISIBILITY_TIMEOUT_SECONDS,
	});

	if (error) {
		log.error({ err: error }, "Failed to claim webhook jobs");
		return;
	}

	if (!jobs || jobs.length === 0) return;

	log.debug({ jobCount: jobs.length }, "Claimed webhook jobs");

	// Process each job concurrently
	const results = await Promise.allSettled(
		jobs.map(
			(job: {
				id: number;
				provider: string;
				event_data: Record<string, unknown>;
				attempts: number;
			}) => processJob(admin, job),
		),
	);

	for (const result of results) {
		if (result.status === "rejected") {
			log.error({ err: result.reason }, "Unhandled error in job processing");
		}
	}
}

/**
 * Process a single webhook job with error isolation.
 */
async function processJob(
	admin: ReturnType<typeof createAdminClient>,
	job: { id: number; provider: string; event_data: Record<string, unknown>; attempts: number },
): Promise<void> {
	const startMs = Date.now();

	try {
		const provider = getProvider(job.provider as ProviderName);

		// Extract owner/activity from event
		const ownerId = provider.extractOwnerIdFromWebhook(job.event_data);
		const activityId = provider.extractActivityIdFromWebhook(job.event_data);

		// Look up connected account
		const { data: account } = await admin
			.from("connected_accounts")
			.select("*")
			.eq("provider", job.provider)
			.eq("provider_uid", ownerId)
			.single();

		if (!account) {
			await logSyncResult(admin, {
				provider: job.provider,
				eventType: "webhook",
				status: "skipped",
				errorMessage: `No account for provider UID ${ownerId}`,
				durationMs: Date.now() - startMs,
			});
			// Mark as completed (no point retrying if account doesn't exist)
			await admin.rpc("complete_webhook_job", { job_id: job.id });
			return;
		}

		// Refresh token if needed
		const accessToken = await ensureFreshToken(provider, account, admin);

		// Fetch full activity
		const activity = await provider.fetchActivity(accessToken, activityId);

		// Fetch health data (optional)
		const healthData = provider.fetchHealthData
			? await provider.fetchHealthData(accessToken, new Date())
			: [];

		// Get club_id
		const { data: profile } = await admin
			.from("profiles")
			.select("club_id")
			.eq("id", account.athlete_id)
			.single();

		if (!profile) {
			await logSyncResult(admin, {
				athleteId: account.athlete_id,
				provider: job.provider,
				eventType: "webhook",
				status: "failed",
				errorMessage: "No profile found",
				durationMs: Date.now() - startMs,
			});
			await admin.rpc("complete_webhook_job", { job_id: job.id });
			return;
		}

		// Normalize + store
		const result = await normalizeAndStore(
			[activity],
			healthData,
			account.athlete_id,
			profile.club_id,
			admin,
		);

		// Update last_sync_at
		await admin
			.from("connected_accounts")
			.update({ last_sync_at: new Date().toISOString() })
			.eq("id", account.id);

		// Mark job completed
		await admin.rpc("complete_webhook_job", { job_id: job.id });

		// Log success
		await logSyncResult(admin, {
			athleteId: account.athlete_id,
			provider: job.provider,
			eventType: "webhook",
			status: "success",
			workoutsAdded: result.workoutsInserted,
			metricsAdded: result.metricsInserted,
			durationMs: Date.now() - startMs,
		});

		log.info(
			{
				provider: job.provider,
				jobId: job.id,
				workoutsInserted: result.workoutsInserted,
				metricsInserted: result.metricsInserted,
				durationMs: Date.now() - startMs,
			},
			"Webhook job complete",
		);
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);

		log.warn({ jobId: job.id, attempt: job.attempts, error: errMsg }, "Webhook job failed");

		// Mark as failed — the DB function handles retry vs dead letter
		await admin.rpc("fail_webhook_job", {
			job_id: job.id,
			err_msg: errMsg,
			retry_delay_seconds: RETRY_DELAY_SECONDS,
		});

		// Log failure on final attempt
		if (job.attempts >= 3) {
			await logSyncResult(admin, {
				provider: job.provider,
				eventType: "webhook",
				status: "failed",
				errorMessage: errMsg,
				durationMs: Date.now() - startMs,
			});
		}
	}
}

/**
 * Log a sync result to the sync_history table.
 */
async function logSyncResult(
	admin: ReturnType<typeof createAdminClient>,
	entry: {
		athleteId?: string;
		provider: string;
		eventType: string;
		status: string;
		workoutsAdded?: number;
		metricsAdded?: number;
		errorMessage?: string;
		durationMs: number;
	},
): Promise<void> {
	try {
		await admin.from("sync_history").insert({
			athlete_id: entry.athleteId || null,
			provider: entry.provider,
			event_type: entry.eventType,
			status: entry.status,
			workouts_added: entry.workoutsAdded || 0,
			metrics_added: entry.metricsAdded || 0,
			error_message: entry.errorMessage || null,
			duration_ms: entry.durationMs,
		});
	} catch (err) {
		log.error({ err }, "Failed to log sync result");
	}
}

/** Stop the queue poller (for graceful shutdown). */
export function stopPolling(): void {
	if (pollIntervalId) {
		clearInterval(pollIntervalId);
		pollIntervalId = null;
		log.info("Webhook queue poller stopped");
	}
}
