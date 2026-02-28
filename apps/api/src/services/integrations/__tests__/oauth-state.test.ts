import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createOAuthState, verifyOAuthState } from "../oauth-state.js";

// Use a stable signing key for tests
beforeEach(() => {
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret-key-for-unit-tests-only");
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("createOAuthState", () => {
    it("returns a base64-encoded string", () => {
        const state = createOAuthState("user-123");
        expect(state).toBeTruthy();
        // Should be valid base64url
        expect(() => Buffer.from(state, "base64")).not.toThrow();
    });

    it("produces different states for different users", () => {
        const state1 = createOAuthState("user-111");
        const state2 = createOAuthState("user-222");
        expect(state1).not.toBe(state2);
    });

    it("produces different states for same user (timestamp differs)", async () => {
        const state1 = createOAuthState("user-123");
        // Wait 2ms to ensure different timestamp
        await new Promise((r) => setTimeout(r, 2));
        const state2 = createOAuthState("user-123");
        expect(state1).not.toBe(state2);
    });
});

describe("verifyOAuthState", () => {
    it("verifies a valid, fresh state", () => {
        const state = createOAuthState("user-abc");
        const result = verifyOAuthState(state);
        expect(result).not.toBeNull();
        expect(result!.athleteId).toBe("user-abc");
    });

    it("returns null for tampered state", () => {
        const state = createOAuthState("user-abc");
        // Flip a character in the middle of the base64 string
        const tampered = state.slice(0, 10) + "X" + state.slice(11);
        const result = verifyOAuthState(tampered);
        expect(result).toBeNull();
    });

    it("returns null for garbage input", () => {
        expect(verifyOAuthState("not-valid")).toBeNull();
        expect(verifyOAuthState("")).toBeNull();
        expect(verifyOAuthState("a:b")).toBeNull();
    });

    it("returns null for expired state (>10 min)", () => {
        // Create a state, then mock Date.now to be 11 minutes later
        const state = createOAuthState("user-abc");
        const elevenMinutesMs = 11 * 60 * 1000;
        const originalNow = Date.now;
        Date.now = () => originalNow() + elevenMinutesMs;

        const result = verifyOAuthState(state);
        expect(result).toBeNull();

        Date.now = originalNow;
    });

    it("verifies a state within the 10-min window", () => {
        const state = createOAuthState("user-abc");
        const nineMinutesMs = 9 * 60 * 1000;
        const originalNow = Date.now;
        Date.now = () => originalNow() + nineMinutesMs;

        const result = verifyOAuthState(state);
        expect(result).not.toBeNull();
        expect(result!.athleteId).toBe("user-abc");

        Date.now = originalNow;
    });

    it("fails when signing key differs", () => {
        const state = createOAuthState("user-abc");
        // Change the signing key
        vi.stubEnv("SUPABASE_JWT_SECRET", "different-key");
        const result = verifyOAuthState(state);
        expect(result).toBeNull();
    });
});
