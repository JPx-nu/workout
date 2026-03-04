// ============================================================
// OAuth State Security — CSRF Protection
// Signs the state parameter with HMAC-SHA256 + expiry.
// Prevents callback URL forgery attacks.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { createLogger } from "../../lib/logger.js";

const log = createLogger({ module: "oauth-state" });

/** State expires after 10 minutes */
const STATE_TTL_MS = 10 * 60 * 1000;
/** 128-bit truncated HMAC for compact but strong CSRF state signatures */
const STATE_SIGNATURE_HEX_CHARS = 32;

function getSigningKey(): string {
	const key =
		process.env.SUPABASE_JWT_SECRET ||
		process.env.JWT_SECRET ||
		"fallback-dev-key-change-in-production";
	return key;
}

/**
 * Create a signed OAuth state parameter.
 * Format: <payloadB64url>.<hmac32>
 * Payload JSON:
 *   { a: athleteId, t: timestampMs, r?: returnTo }
 */
export function createOAuthState(athleteId: string, returnTo?: string): string {
	const payloadObj = {
		a: athleteId,
		t: Date.now(),
		...(returnTo ? { r: returnTo } : {}),
	};
	const payloadB64 = Buffer.from(JSON.stringify(payloadObj), "utf8").toString("base64url");
	const hmac = createHmac("sha256", getSigningKey())
		.update(payloadB64)
		.digest("hex")
		.slice(0, STATE_SIGNATURE_HEX_CHARS);
	return `${payloadB64}.${hmac}`;
}

/**
 * Verify and decode a signed OAuth state parameter.
 * Returns the decoded payload if valid, null if tampered/expired.
 */
export function verifyOAuthState(state: string): { athleteId: string; returnTo?: string } | null {
	try {
		// New format: <payloadB64>.<hmac>
		if (state.includes(".")) {
			const segments = state.split(".");
			if (segments.length !== 2) return null;
			const [payloadB64, receivedHmac] = segments;
			if (!payloadB64 || !receivedHmac) return null;
			if (receivedHmac.length !== STATE_SIGNATURE_HEX_CHARS) return null;

			const expectedHmac = createHmac("sha256", getSigningKey())
				.update(payloadB64)
				.digest("hex")
				.slice(0, STATE_SIGNATURE_HEX_CHARS);

			const a = Buffer.from(receivedHmac, "utf8");
			const b = Buffer.from(expectedHmac, "utf8");
			if (a.length !== b.length || !timingSafeEqual(a, b)) {
				log.warn("Invalid HMAC signature on OAuth state");
				return null;
			}

			const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
				a?: string;
				t?: number;
				r?: string;
			};

			if (typeof payload.a !== "string" || typeof payload.t !== "number") {
				return null;
			}
			if (Date.now() - payload.t > STATE_TTL_MS) {
				log.warn("OAuth state expired");
				return null;
			}

			return {
				athleteId: payload.a,
				...(typeof payload.r === "string" && payload.r.length > 0 ? { returnTo: payload.r } : {}),
			};
		}

		// Legacy format fallback: base64url(athleteId:timestamp:hmac)
		const decoded = Buffer.from(state, "base64url").toString("utf8");
		const parts = decoded.split(":");
		if (parts.length !== 3) return null;

		const [athleteId, timestamp, receivedHmac] = parts;
		const ts = parseInt(timestamp, 36);
		if (Date.now() - ts > STATE_TTL_MS) {
			log.warn("OAuth state expired");
			return null;
		}

		const expectedHmac = createHmac("sha256", getSigningKey())
			.update(`${athleteId}:${timestamp}`)
			.digest("hex")
			.slice(0, 16);

		const a = Buffer.from(receivedHmac, "utf8");
		const b = Buffer.from(expectedHmac, "utf8");
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			log.warn("Invalid HMAC signature on OAuth state");
			return null;
		}

		return { athleteId };
	} catch {
		log.warn("Failed to decode OAuth state");
		return null;
	}
}
