// ============================================================
// Integration Errors — Structured Error Types
// Typed errors for better debugging, logging, and handling.
// ============================================================

/** Base error for all integration operations */
export class IntegrationError extends Error {
    constructor(
        public readonly provider: string,
        message: string,
        public readonly cause?: Error,
    ) {
        super(`[${provider}] ${message}`);
        this.name = "IntegrationError";
    }
}

/** Token has expired and refresh failed */
export class TokenExpiredError extends IntegrationError {
    constructor(provider: string, cause?: Error) {
        super(provider, "Access token expired and could not be refreshed", cause);
        this.name = "TokenExpiredError";
    }
}

/** Provider API returned 429 Too Many Requests */
export class RateLimitedError extends IntegrationError {
    constructor(
        provider: string,
        public readonly retryAfterMs: number,
    ) {
        super(
            provider,
            `Rate limited — retry after ${Math.ceil(retryAfterMs / 1000)}s`,
        );
        this.name = "RateLimitedError";
    }
}

/** Webhook signature verification failed */
export class WebhookVerificationError extends IntegrationError {
    constructor(provider: string) {
        super(provider, "Webhook signature verification failed");
        this.name = "WebhookVerificationError";
    }
}

/** Provider API returned an error response */
export class ProviderApiError extends IntegrationError {
    constructor(
        provider: string,
        public readonly statusCode: number,
        message: string,
    ) {
        super(provider, `API error ${statusCode}: ${message}`);
        this.name = "ProviderApiError";
    }
}

/** OAuth state parameter is invalid or expired */
export class OAuthStateError extends IntegrationError {
    constructor(provider: string) {
        super(provider, "Invalid or expired OAuth state — possible CSRF attack");
        this.name = "OAuthStateError";
    }
}

/** Provider is not yet available (e.g. Garmin pending approval) */
export class ProviderUnavailableError extends IntegrationError {
    constructor(provider: string, reason: string) {
        super(provider, `Provider unavailable: ${reason}`);
        this.name = "ProviderUnavailableError";
    }
}
