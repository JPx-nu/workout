// ============================================================
// OAuth Factory
// Generic OAuth2 flow that works for all providers.
// Handles: authorization URL, code exchange, token storage,
// backfill on first connect.
//
// Security: HMAC-signed state (CSRF), AES-256-GCM token encryption
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import { INTEGRATION_CONFIG } from "../../config/integrations.js";
import { createLogger } from "../../lib/logger.js";
import { jsonProblem } from "../../lib/problem-details.js";
import { getAuth } from "../../middleware/auth.js";
import { createAdminClient } from "../ai/supabase.js";
import { decryptToken, encryptToken, isEncrypted } from "./crypto.js";
import { IntegrationError, OAuthStateError } from "./errors.js";
import { normalizeAndStore } from "./normalizer.js";
import { createOAuthState, verifyOAuthState } from "./oauth-state.js";
import { getActiveConnection } from "./token-manager.js";
import type { IntegrationProvider, ProviderName } from "./types.js";

const log = createLogger({ module: "oauth" });

function defaultSettingsUrl(): string {
	return `${INTEGRATION_CONFIG.webUrl}/workout/settings`;
}

function normalizeAllowedOrigin(raw: string): string | null {
	try {
		const parsed = new URL(raw);
		if (!["http:", "https:"].includes(parsed.protocol)) return null;
		return parsed.origin;
	} catch {
		return null;
	}
}

function getAllowedReturnOrigins(): string[] {
	const configured = (process.env.ALLOWED_OAUTH_RETURN_ORIGINS ?? "")
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);

	const defaults = new Set<string>();
	try {
		defaults.add(new URL(INTEGRATION_CONFIG.webUrl).origin);
	} catch {
		// no-op
	}

	// Known local development origins
	defaults.add("http://localhost:3100");
	defaults.add("http://localhost:8787");

	for (const item of configured) {
		const normalized = normalizeAllowedOrigin(item);
		if (!normalized) {
			log.warn({ origin: item }, "Ignored invalid ALLOWED_OAUTH_RETURN_ORIGINS entry");
			continue;
		}
		defaults.add(normalized);
	}

	return [...defaults];
}

function sanitizeReturnTo(returnToRaw?: string): string {
	if (!returnToRaw || returnToRaw.trim().length === 0) {
		return defaultSettingsUrl();
	}

	try {
		const parsed = new URL(returnToRaw);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			log.warn({ returnTo: returnToRaw }, "Rejected OAuth returnTo unsupported protocol");
			return defaultSettingsUrl();
		}
		const allowedOrigins = new Set(getAllowedReturnOrigins());
		if (!allowedOrigins.has(parsed.origin)) {
			log.warn({ returnTo: returnToRaw }, "Rejected OAuth returnTo origin");
			return defaultSettingsUrl();
		}
		// HTTPS-only outside local development origins
		const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
		if (!local && parsed.protocol !== "https:") {
			log.warn({ returnTo: returnToRaw }, "Rejected non-https OAuth returnTo");
			return defaultSettingsUrl();
		}
		return parsed.toString();
	} catch {
		log.warn({ returnTo: returnToRaw }, "Rejected invalid OAuth returnTo URL");
		return defaultSettingsUrl();
	}
}

/**
 * Build the OAuth authorization redirect URL for a provider.
 * State is HMAC-signed with the athleteId + optional returnTo + 10-min expiry.
 */
export function buildAuthorizationUrl(
	provider: IntegrationProvider,
	athleteId: string,
	returnToRaw?: string,
): string {
	const returnTo = sanitizeReturnTo(returnToRaw);
	const state = createOAuthState(athleteId, returnTo);
	return provider.buildAuthUrl(state);
}

/**
 * Verify the OAuth callback state and extract the athlete ID and safe return target.
 * Throws OAuthStateError if tampered or expired.
 */
export function verifyCallbackState(
	provider: IntegrationProvider,
	state: string,
): { athleteId: string; returnTo: string } {
	const result = verifyOAuthState(state);
	if (!result) {
		throw new OAuthStateError(provider.name);
	}
	return {
		athleteId: result.athleteId,
		returnTo: sanitizeReturnTo(result.returnTo),
	};
}

/**
 * Handle the OAuth callback: exchange code → encrypt tokens → store → backfill.
 * Called from the provider-specific callback route.
 */
export async function handleOAuthCallback(
	provider: IntegrationProvider,
	code: string,
	athleteId: string,
	clubId: string,
	client: SupabaseClient,
): Promise<{ success: boolean; provider: string }> {
	// 1. Exchange authorization code for tokens
	const tokens = await provider.exchangeCode(code);

	// 2. Encrypt tokens before storage
	const encAccessToken = encryptToken(tokens.accessToken);
	const encRefreshToken = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null;

	// 3. Upsert connected account with encrypted tokens
	const { error: upsertError } = await client.from("connected_accounts").upsert(
		{
			athlete_id: athleteId,
			provider: provider.name,
			access_token: encAccessToken,
			refresh_token: encRefreshToken,
			token_expires: tokens.expiresAt.toISOString(),
			provider_uid: tokens.providerUserId,
			scopes: tokens.scopes,
			last_sync_at: null,
		},
		{ onConflict: "athlete_id,provider" },
	);

	if (upsertError) {
		log.error({ err: upsertError, provider: provider.name }, "Failed to store tokens");
		throw new IntegrationError(provider.name, `Failed to store connection: ${upsertError.message}`);
	}

	log.info(
		{ provider: provider.name, athleteId, providerUid: tokens.providerUserId },
		"Provider connected",
	);

	// 4. Backfill last 30 days of activities (fire-and-forget)
	backfillActivities(
		provider,
		tokens.accessToken, // Use plaintext for immediate API calls
		athleteId,
		clubId,
		client,
	)
		.then((result) => {
			log.info(
				{
					provider: provider.name,
					workoutsInserted: result.workoutsInserted,
					metricsInserted: result.metricsInserted,
				},
				"Backfill complete",
			);
		})
		.catch((err) => {
			log.error({ err, provider: provider.name }, "Backfill failed");
		});

	return { success: true, provider: provider.name };
}

/**
 * Backfill activities from a provider for the last N days.
 */
async function backfillActivities(
	provider: IntegrationProvider,
	accessToken: string,
	athleteId: string,
	clubId: string,
	client: SupabaseClient,
	daysBack = 30,
) {
	const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

	const activities = await provider.fetchActivities(accessToken, since);

	const metrics: import("./types.js").NormalizedMetric[] = [];
	if (provider.fetchHealthData) {
		const todayMetrics = await provider.fetchHealthData(accessToken, new Date());
		metrics.push(...todayMetrics);
	}

	return normalizeAndStore(activities, metrics, athleteId, clubId, client);
}

// ── Shared Route Handlers ────────────────────────────────────
// Extracted from the near-identical strava/polar/wahoo route files.

/**
 * Shared OAuth callback handler for all providers.
 * Verifies HMAC state, looks up club_id, exchanges code, redirects.
 */
export async function handleProviderOAuthCallback(
	provider: IntegrationProvider,
	providerSlug: string,
	c: Context,
): Promise<Response> {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");
	const fallbackTarget = defaultSettingsUrl();

	if (error || !code || !state) {
		log.error({ error, provider: providerSlug }, "OAuth callback error");
		const denied = new URL(fallbackTarget);
		denied.searchParams.set("integration", providerSlug);
		denied.searchParams.set("error", "denied");
		return c.redirect(denied.toString());
	}

	try {
		const callbackState = verifyCallbackState(provider, state);
		const athleteId = callbackState.athleteId;
		const redirectTarget = new URL(callbackState.returnTo);
		const client = createAdminClient();
		const { data: profile } = await client
			.from("profiles")
			.select("club_id")
			.eq("id", athleteId)
			.single();

		if (!profile) {
			return c.json({ error: "Athlete not found" }, 404);
		}

		await handleOAuthCallback(provider, code, athleteId, profile.club_id, client);
		redirectTarget.searchParams.set("integration", providerSlug);
		redirectTarget.searchParams.set("status", "connected");
		return c.redirect(redirectTarget.toString());
	} catch (err) {
		log.error({ err, provider: providerSlug }, "OAuth callback failed");
		const failed = new URL(fallbackTarget);
		failed.searchParams.set("integration", providerSlug);
		failed.searchParams.set("error", "failed");
		return c.redirect(failed.toString());
	}
}

/**
 * Shared manual sync handler for all providers.
 * Rate-limited via PostgreSQL `check_rate_limit()` (survives restarts).
 * Fetches activities (and health data if the provider supports it).
 */
export async function handleProviderSync(
	provider: IntegrationProvider,
	providerName: ProviderName,
	c: Context,
): Promise<Response> {
	const auth = getAuth(c);
	const client = createAdminClient();

	// DB-backed rate limit: 1 sync per cooldown window per user+provider
	const cooldownSec = Math.ceil(INTEGRATION_CONFIG.syncCooldownMs / 1000);
	try {
		const { data: remaining, error } = await client.rpc("check_rate_limit", {
			rate_key: `sync:${providerName}:${auth.userId}`,
			max_requests: 1,
			window_seconds: cooldownSec,
		});

		if (!error && (remaining as number) < 0) {
			return jsonProblem(c, 429, "Too Many Requests", {
				code: "SYNC_RATE_LIMITED",
				detail: "Please wait before syncing again.",
				hint: `Retry after ${cooldownSec} seconds.`,
				type: "https://docs.jpx.nu/problems/sync-rate-limited",
			});
		}
	} catch {
		// Fail open — allow sync if rate limit check fails
	}

	const connection = await getActiveConnection(providerName, auth.userId, client);

	if (!connection) {
		return jsonProblem(c, 400, "Bad Request", {
			code: "PROVIDER_NOT_CONNECTED",
			detail: `${providerName} is not connected for this user.`,
			type: "https://docs.jpx.nu/problems/provider-not-connected",
		});
	}

	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const activities = await provider.fetchActivities(connection.accessToken, since);

	const healthData = provider.fetchHealthData
		? await provider.fetchHealthData(connection.accessToken, new Date())
		: [];

	const result = await normalizeAndStore(activities, healthData, auth.userId, auth.clubId, client);

	await client
		.from("connected_accounts")
		.update({ last_sync_at: new Date().toISOString() })
		.eq("id", connection.account.id);

	return c.json({
		status: "synced",
		workoutsInserted: result.workoutsInserted,
		workoutsSkipped: result.workoutsSkipped,
		metricsInserted: result.metricsInserted,
	});
}

/**
 * Disconnect a provider: revoke access + delete stored tokens.
 */
export async function disconnectProvider(
	provider: IntegrationProvider,
	athleteId: string,
	client: SupabaseClient,
): Promise<void> {
	// Get stored tokens
	const { data: account } = await client
		.from("connected_accounts")
		.select("*")
		.eq("athlete_id", athleteId)
		.eq("provider", provider.name)
		.single();

	if (account) {
		// Decrypt token for revocation
		let plainToken = account.access_token;
		try {
			if (isEncrypted(account.access_token)) {
				plainToken = decryptToken(account.access_token);
			}
		} catch {
			// If decrypt fails, try revoking with stored value anyway
		}

		// Revoke on provider side (best effort)
		try {
			await provider.revokeAccess(plainToken);
		} catch (err) {
			log.warn({ err, provider: provider.name }, "Failed to revoke access (continuing)");
		}

		// Delete from DB
		await client
			.from("connected_accounts")
			.delete()
			.eq("athlete_id", athleteId)
			.eq("provider", provider.name);
	}

	log.info({ provider: provider.name, athleteId }, "Provider disconnected");
}
