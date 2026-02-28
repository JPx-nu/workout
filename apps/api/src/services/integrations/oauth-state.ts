// ============================================================
// OAuth State Security — CSRF Protection
// Signs the state parameter with HMAC-SHA256 + expiry.
// Prevents callback URL forgery attacks.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";

/** State expires after 10 minutes */
const STATE_TTL_MS = 10 * 60 * 1000;

function getSigningKey(): string {
    const key =
        process.env.SUPABASE_JWT_SECRET ||
        process.env.JWT_SECRET ||
        "fallback-dev-key-change-in-production";
    return key;
}

/**
 * Create a signed OAuth state parameter.
 * Format: base64url(athleteId:timestamp:hmac)
 */
export function createOAuthState(athleteId: string): string {
    const timestamp = Date.now().toString(36);
    const payload = `${athleteId}:${timestamp}`;
    const hmac = createHmac("sha256", getSigningKey())
        .update(payload)
        .digest("hex")
        .slice(0, 16); // 16 hex chars = 64 bits — sufficient for CSRF

    const state = Buffer.from(`${payload}:${hmac}`).toString("base64url");
    return state;
}

/**
 * Verify and decode a signed OAuth state parameter.
 * Returns the athleteId if valid, null if tampered/expired.
 */
export function verifyOAuthState(
    state: string,
): { athleteId: string } | null {
    try {
        const decoded = Buffer.from(state, "base64url").toString("utf8");
        const parts = decoded.split(":");

        if (parts.length !== 3) return null;

        const [athleteId, timestamp, receivedHmac] = parts;

        // Check expiry
        const ts = parseInt(timestamp, 36);
        if (Date.now() - ts > STATE_TTL_MS) {
            console.warn("[OAuthState] State expired");
            return null;
        }

        // Verify HMAC
        const expectedHmac = createHmac("sha256", getSigningKey())
            .update(`${athleteId}:${timestamp}`)
            .digest("hex")
            .slice(0, 16);

        const a = Buffer.from(receivedHmac, "utf8");
        const b = Buffer.from(expectedHmac, "utf8");

        if (a.length !== b.length || !timingSafeEqual(a, b)) {
            console.warn("[OAuthState] Invalid HMAC signature");
            return null;
        }

        return { athleteId };
    } catch {
        console.warn("[OAuthState] Failed to decode state");
        return null;
    }
}
