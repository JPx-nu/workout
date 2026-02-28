// ============================================================
// Webhook Queue — Async Processing
// Acknowledge webhooks immediately, process in background.
// Prevents timeout failures from provider API calls.
// Uses in-process queue with error isolation.
// ============================================================

import type { ProviderName } from "./types.js";
import { getProvider } from "./registry.js";
import { ensureFreshToken } from "./token-manager.js";
import { normalizeAndStore } from "./normalizer.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { IntegrationError } from "./errors.js";

export interface WebhookJob {
    id: string;
    provider: ProviderName;
    event: Record<string, unknown>;
    receivedAt: Date;
    attempts: number;
}

/** Max retry attempts per failed job */
const MAX_JOB_ATTEMPTS = 3;

/** Delay between queue processing cycles (ms) */
const PROCESS_INTERVAL_MS = 2000;

/** The in-memory job queue */
const queue: WebhookJob[] = [];
let processing = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Enqueue a webhook job for async processing.
 * Returns immediately — the webhook handler can respond 200.
 */
export function enqueueWebhook(
    provider: ProviderName,
    event: Record<string, unknown>,
): void {
    const job: WebhookJob = {
        id: `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider,
        event,
        receivedAt: new Date(),
        attempts: 0,
    };

    queue.push(job);
    console.log(
        `[WebhookQueue] Enqueued ${provider} job ${job.id} (queue size: ${queue.length})`,
    );

    // Auto-start processing if not already running
    ensureProcessing();
}

/**
 * Start the queue processor if not already running.
 */
function ensureProcessing(): void {
    if (intervalId) return;

    intervalId = setInterval(async () => {
        if (processing || queue.length === 0) return;
        processing = true;

        try {
            const job = queue.shift();
            if (job) await processJob(job);
        } finally {
            processing = false;

            // Stop interval if queue is empty
            if (queue.length === 0 && intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    }, PROCESS_INTERVAL_MS);
}

/**
 * Process a single webhook job with error isolation.
 */
async function processJob(job: WebhookJob): Promise<void> {
    const startMs = Date.now();
    const admin = createAdminClient();

    try {
        const provider = getProvider(job.provider);

        // Extract owner/activity from event
        const ownerId = provider.extractOwnerIdFromWebhook(job.event);
        const activityId = provider.extractActivityIdFromWebhook(job.event);

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

        console.log(
            `[WebhookQueue] ${job.provider} job ${job.id} complete: ${result.workoutsInserted} workouts, ${result.metricsInserted} metrics (${Date.now() - startMs}ms)`,
        );
    } catch (err) {
        job.attempts++;
        const errMsg =
            err instanceof Error ? err.message : String(err);

        if (job.attempts < MAX_JOB_ATTEMPTS) {
            console.warn(
                `[WebhookQueue] Job ${job.id} failed (attempt ${job.attempts}/${MAX_JOB_ATTEMPTS}): ${errMsg}`,
            );
            // Re-enqueue for retry
            queue.push(job);
        } else {
            console.error(
                `[WebhookQueue] Job ${job.id} permanently failed after ${MAX_JOB_ATTEMPTS} attempts: ${errMsg}`,
            );
            // Log failure
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
        console.error("[WebhookQueue] Failed to log sync result:", err);
    }
}

/** Get current queue size (for monitoring) */
export function getQueueSize(): number {
    return queue.length;
}
