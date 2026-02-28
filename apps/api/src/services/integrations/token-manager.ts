// ============================================================
// Token Manager
// Ensures access tokens are fresh before making API calls.
// Handles automatic refresh with a 5-minute buffer.
//
// Security: Decrypts tokens from DB, re-encrypts after refresh.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectedAccount, IntegrationProvider } from "./types.js";
import { getProvider } from "./registry.js";
import { encryptToken, decryptToken, isEncrypted } from "./crypto.js";
import { TokenExpiredError } from "./errors.js";

/** Buffer before expiry to trigger a refresh (5 min) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Ensure the access token for a connected account is fresh.
 * Returns a **plaintext** access token, refreshing if needed.
 * Decrypt → check expiry → refresh if needed → re-encrypt + store.
 */
export async function ensureFreshToken(
    provider: IntegrationProvider,
    account: ConnectedAccount,
    client: SupabaseClient,
): Promise<string> {
    // Decrypt the stored token
    let plainAccessToken: string;
    try {
        plainAccessToken = isEncrypted(account.access_token)
            ? decryptToken(account.access_token)
            : account.access_token;
    } catch {
        // If decryption fails, try using as-is (migration scenario)
        plainAccessToken = account.access_token;
    }

    // If no expiry set or token still valid, return as-is
    if (account.token_expires) {
        const expiresAt = new Date(account.token_expires);
        if (expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
            return plainAccessToken;
        }
    } else {
        // No expiry info — assume token is valid (some providers don't expire)
        return plainAccessToken;
    }

    // Token expired or about to expire — refresh it
    let plainRefreshToken: string | null = null;
    if (account.refresh_token) {
        try {
            plainRefreshToken = isEncrypted(account.refresh_token)
                ? decryptToken(account.refresh_token)
                : account.refresh_token;
        } catch {
            plainRefreshToken = account.refresh_token;
        }
    }

    if (!plainRefreshToken) {
        throw new TokenExpiredError(provider.name);
    }

    console.log(
        `[TokenManager] Refreshing ${provider.name} token for athlete ${account.athlete_id}`,
    );

    const tokens = await provider.refreshToken(plainRefreshToken);

    // Re-encrypt and update stored tokens
    const { error } = await client
        .from("connected_accounts")
        .update({
            access_token: encryptToken(tokens.accessToken),
            refresh_token: tokens.refreshToken
                ? encryptToken(tokens.refreshToken)
                : account.refresh_token,
            token_expires: tokens.expiresAt.toISOString(),
        })
        .eq("id", account.id);

    if (error) {
        console.error("[TokenManager] Failed to update tokens:", error);
    }

    return tokens.accessToken;
}

/**
 * Get connected account + fresh token for a given provider and athlete.
 * Returns null if the athlete hasn't connected this provider.
 */
export async function getActiveConnection(
    providerName: string,
    athleteId: string,
    client: SupabaseClient,
): Promise<{ account: ConnectedAccount; accessToken: string } | null> {
    const { data: account } = await client
        .from("connected_accounts")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("provider", providerName)
        .single();

    if (!account) return null;

    const provider = getProvider(
        providerName as import("./types.js").ProviderName,
    );
    const accessToken = await ensureFreshToken(provider, account, client);

    return { account, accessToken };
}

/**
 * Get all connected accounts for an athlete.
 * Useful for the Settings page.
 */
export async function getConnectedAccounts(
    athleteId: string,
    client: SupabaseClient,
): Promise<
    Array<{
        provider: string;
        connected: boolean;
        lastSyncAt: string | null;
        providerUid: string | null;
    }>
> {
    const { data: accounts } = await client
        .from("connected_accounts")
        .select("provider, last_sync_at, provider_uid")
        .eq("athlete_id", athleteId);

    return (accounts || []).map((a) => ({
        provider: a.provider,
        connected: true,
        lastSyncAt: a.last_sync_at,
        providerUid: a.provider_uid,
    }));
}
