import { describe, expect, it } from "vitest";
import {
    IntegrationError,
    TokenExpiredError,
    RateLimitedError,
    ProviderApiError,
    WebhookVerificationError,
    OAuthStateError,
    ProviderUnavailableError,
} from "../errors.js";

describe("IntegrationError", () => {
    it("includes provider in message", () => {
        const err = new IntegrationError("STRAVA", "something broke");
        expect(err.message).toBe("[STRAVA] something broke");
        expect(err.provider).toBe("STRAVA");
        expect(err.name).toBe("IntegrationError");
    });
});

describe("TokenExpiredError", () => {
    it("has correct name and provider", () => {
        const err = new TokenExpiredError("POLAR");
        expect(err.name).toBe("TokenExpiredError");
        expect(err.provider).toBe("POLAR");
    });
});

describe("RateLimitedError", () => {
    it("stores retryAfterMs", () => {
        const err = new RateLimitedError("STRAVA", 30000);
        expect(err.retryAfterMs).toBe(30000);
        expect(err.name).toBe("RateLimitedError");
    });
});

describe("ProviderApiError", () => {
    it("stores statusCode", () => {
        const err = new ProviderApiError("WAHOO", 503, "Service unavailable");
        expect(err.statusCode).toBe(503);
        expect(err.provider).toBe("WAHOO");
        expect(err.message).toContain("503");
    });
});

describe("WebhookVerificationError", () => {
    it("has correct name", () => {
        const err = new WebhookVerificationError("GARMIN");
        expect(err.name).toBe("WebhookVerificationError");
    });
});

describe("OAuthStateError", () => {
    it("has correct name", () => {
        const err = new OAuthStateError("STRAVA");
        expect(err.name).toBe("OAuthStateError");
    });
});

describe("ProviderUnavailableError", () => {
    it("has correct name and reason", () => {
        const err = new ProviderUnavailableError("GARMIN", "API approval pending");
        expect(err.name).toBe("ProviderUnavailableError");
        expect(err.message).toContain("API approval pending");
    });
});

describe("Error hierarchy", () => {
    it("all errors extend IntegrationError", () => {
        expect(new TokenExpiredError("X")).toBeInstanceOf(IntegrationError);
        expect(new RateLimitedError("X", 1000)).toBeInstanceOf(IntegrationError);
        expect(new ProviderApiError("X", 500, "fail")).toBeInstanceOf(IntegrationError);
        expect(new WebhookVerificationError("X")).toBeInstanceOf(IntegrationError);
        expect(new OAuthStateError("X")).toBeInstanceOf(IntegrationError);
        expect(new ProviderUnavailableError("X", "r")).toBeInstanceOf(IntegrationError);
    });

    it("all errors extend Error", () => {
        expect(new IntegrationError("X", "m")).toBeInstanceOf(Error);
        expect(new ProviderApiError("X", 404, "not found")).toBeInstanceOf(Error);
    });
});
