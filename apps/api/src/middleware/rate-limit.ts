/**
 * Rate Limiter Middleware — Sliding window, per-IP
 *
 * In-memory sliding window rate limiter for Hono.
 * Uses Draft 7 RateLimit response headers.
 *
 * TODO: Replace with Redis/KV store for multi-instance deployments.
 */

import { createMiddleware } from 'hono/factory';

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

// ── Sliding Window Store ───────────────────────────────────────

interface WindowEntry {
    timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000);
        if (entry.timestamps.length === 0) {
            store.delete(key);
        }
    }
}, 300_000);

// ── Middleware Factory ─────────────────────────────────────────

export function rateLimit(config: RateLimitConfig) {
    const { limit, windowSeconds } = config;
    const windowMs = windowSeconds * 1000;

    return createMiddleware(async (c, next) => {
        const clientId =
            c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
            c.req.header('x-real-ip') ||
            'unknown';

        const key = `${clientId}:${c.req.path}`;
        const now = Date.now();

        let entry = store.get(key);
        if (!entry) {
            entry = { timestamps: [] };
            store.set(key, entry);
        }

        // Remove expired timestamps
        entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

        if (entry.timestamps.length >= limit) {
            const oldestInWindow = entry.timestamps[0]!;
            const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000);

            c.header('RateLimit-Limit', String(limit));
            c.header('RateLimit-Remaining', '0');
            c.header('RateLimit-Reset', String(retryAfter));
            c.header('Retry-After', String(retryAfter));

            return c.json(
                {
                    error: 'Too many requests',
                    retryAfter,
                },
                429,
            );
        }

        // Record this request
        entry.timestamps.push(now);

        // Set rate limit headers (Draft 7)
        c.header('RateLimit-Limit', String(limit));
        c.header('RateLimit-Remaining', String(limit - entry.timestamps.length));
        c.header('RateLimit-Reset', String(windowSeconds));

        await next();
    });
}
