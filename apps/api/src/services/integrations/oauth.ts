// ============================================================
// OAuth Factory
// Generic OAuth2 flow that works for all providers.
// Handles: authorization URL, code exchange, token storage,
// backfill on first connect.
//
// Security: HMAC-signed state (CSRF), AES-256-GCM token encryption
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../../lib/logger.js";
import { decryptToken, encryptToken, isEncrypted } from "./crypto.js";
import { IntegrationError, OAuthStateError } from "./errors.js";
import { normalizeAndStore } from "./normalizer.js";
import { createOAuthState, verifyOAuthState } from "./oauth-state.js";
import type { IntegrationProvider } from "./types.js";

const log = createLogger({ module: "oauth" });

/**
 * Build the OAuth authorization redirect URL for a provider.
 * State is HMAC-signed with the athleteId + 10-min expiry.
 */
export function buildAuthorizationUrl(provider: IntegrationProvider, athleteId: string): string {
	const state = createOAuthState(athleteId);
	return provider.buildAuthUrl(state);
}

/**
 * Verify the OAuth callback state and extract the athlete ID.
 * Throws OAuthStateError if tampered or expired.
 */
export function verifyCallbackState(provider: IntegrationProvider, state: string): string {
	const result = verifyOAuthState(state);
	if (!result) {
		throw new OAuthStateError(provider.name);
	}
	return result.athleteId;
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
