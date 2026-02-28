// ============================================================
// HTTP Client — Retry with Exponential Backoff
// Generic fetch wrapper for all provider API calls.
// Retries on transient errors, respects Retry-After headers.
// ============================================================

export interface RetryConfig {
    /** Max number of retries (default: 3) */
    maxRetries?: number;
    /** Base delay in ms (default: 1000) — doubles on each retry */
    baseDelayMs?: number;
    /** Timeout per request in ms (default: 15000) */
    timeoutMs?: number;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    timeoutMs: 15000,
};

/** HTTP status codes that warrant a retry */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Status codes that should NOT be retried */
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 409, 422]);

/**
 * Fetch with automatic retry and exponential backoff.
 * Retries on network errors and 5xx/429 responses.
 * Respects Retry-After header from the server.
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    config: RetryConfig = {},
): Promise<Response> {
    const { maxRetries, baseDelayMs, timeoutMs } = {
        ...DEFAULT_CONFIG,
        ...config,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Add timeout via AbortController
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const res = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timeout);

            // Success — return immediately
            if (res.ok) return res;

            // Non-retryable status — fail fast
            if (NON_RETRYABLE_STATUS.has(res.status)) return res;

            // Retryable status — wait and retry
            if (RETRYABLE_STATUS.has(res.status) && attempt < maxRetries) {
                const delay = getDelay(res, attempt, baseDelayMs);
                console.warn(
                    `[HTTP] ${res.status} from ${url} — retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
                );
                await sleep(delay);
                continue;
            }

            // Max retries exhausted — return the last response
            return res;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));

            // AbortError = timeout
            if (attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, attempt);
                console.warn(
                    `[HTTP] Error fetching ${url}: ${lastError.message} — retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
                );
                await sleep(delay);
                continue;
            }
        }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Calculate delay, respecting Retry-After header.
 */
function getDelay(
    response: Response,
    attempt: number,
    baseDelayMs: number,
): number {
    const retryAfter = response.headers.get("Retry-After");

    if (retryAfter) {
        // Retry-After can be seconds or HTTP-date
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
            return seconds * 1000;
        }
        // Try HTTP-date
        const date = new Date(retryAfter).getTime();
        if (!isNaN(date)) {
            return Math.max(0, date - Date.now());
        }
    }

    // Exponential backoff with jitter
    const exponential = baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * baseDelayMs * 0.5;
    return exponential + jitter;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
