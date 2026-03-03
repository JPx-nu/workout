/**
 * Rate Limiter Middleware — PostgreSQL-backed sliding window
 *
 * Distributed rate limiting that works across multiple API instances.
 * Uses a PostgreSQL function for atomic check-and-increment.
 * Falls back to allowing requests when DB is unreachable (fail-open).
 *
 * Uses Draft 7 RateLimit response headers.
 */

import { createMiddleware } from "hono/factory";
import { createLogger } from "../lib/logger.js";
import { createAdminClient } from "../services/ai/supabase.js";

const log = createLogger({ module: "rate-limit" });

// ── Configuration ──────────────────────────────────────────────

interface RateLimitConfig {
	/** Max requests allowed in the window */
	limit: number;
	/** Window duration in seconds */
	windowSeconds: number;
}

/** Presets for different route groups */
export const RATE_LIMITS = {
	aiChat: { limit: 20, windowSeconds: 60 } satisfies RateLimitConfig,
	apiRead: { limit: 100, windowSeconds: 60 } satisfies RateLimitConfig,
	webhooks: { limit: 200, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;

// ── Middleware Factory ─────────────────────────────────────────

export function rateLimit(config: RateLimitConfig) {
	const { limit, windowSeconds } = config;

	return createMiddleware(async (c, next) => {
		const clientId =
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
			c.req.header("x-real-ip") ||
			"unknown";

		const key = `${clientId}:${c.req.path}`;

		let remaining: number;

		try {
			const supabase = createAdminClient();
			const { data, error } = await supabase.rpc("check_rate_limit", {
				rate_key: key,
				max_requests: limit,
				window_seconds: windowSeconds,
			});

			if (error) {
				log.warn({ err: error }, "Rate limit DB check failed, allowing request");
				remaining = limit; // fail open
			} else {
				remaining = data as number;
			}
		} catch {
			log.warn("Rate limit DB unreachable, allowing request");
			remaining = limit; // fail open
		}

		if (remaining < 0) {
			c.header("RateLimit-Limit", String(limit));
			c.header("RateLimit-Remaining", "0");
			c.header("RateLimit-Reset", String(windowSeconds));
			c.header("Retry-After", String(windowSeconds));

			return c.json(
				{
					error: "Too many requests",
					retryAfter: windowSeconds,
				},
				429,
			);
		}

		// Set rate limit headers (Draft 7)
		c.header("RateLimit-Limit", String(limit));
		c.header("RateLimit-Remaining", String(Math.max(0, remaining)));
		c.header("RateLimit-Reset", String(windowSeconds));

		await next();
	});
}
