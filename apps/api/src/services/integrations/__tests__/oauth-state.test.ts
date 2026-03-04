import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOAuthState, verifyOAuthState } from "../oauth-state.js";

// Use a stable signing key for tests
beforeEach(() => {
	vi.stubEnv("SUPABASE_JWT_SECRET", "test-secret-key-for-unit-tests-only");
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("createOAuthState", () => {
	it("returns a signed payload state", () => {
		const state = createOAuthState("user-123");
		expect(state).toBeTruthy();
		const [payloadB64, hmac] = state.split(".");
		expect(payloadB64).toBeTruthy();
		expect(hmac).toMatch(/^[a-f0-9]{32}$/);

		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
			a?: string;
			t?: number;
			r?: string;
		};
		expect(payload.a).toBe("user-123");
		expect(typeof payload.t).toBe("number");
		expect(payload.r).toBeUndefined();
	});

	it("includes returnTo when provided", () => {
		const state = createOAuthState("user-123", "https://jpx.nu/workout/settings");
		const [payloadB64] = state.split(".");
		const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
			a?: string;
			t?: number;
			r?: string;
		};
		expect(payload.a).toBe("user-123");
		expect(payload.r).toBe("https://jpx.nu/workout/settings");
	});

	it("produces different states for different users", () => {
		const state1 = createOAuthState("user-111");
		const state2 = createOAuthState("user-222");
		expect(state1).not.toBe(state2);
	});

	it("produces different states for same user (timestamp differs)", () => {
		const nowSpy = vi.spyOn(Date, "now");
		nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1001);
		const state1 = createOAuthState("user-123");
		const state2 = createOAuthState("user-123");
		expect(state1).not.toBe(state2);
	});
});

describe("verifyOAuthState", () => {
	it("verifies a valid, fresh state", () => {
		const state = createOAuthState("user-abc");
		const result = verifyOAuthState(state);
		expect(result).not.toBeNull();
		expect(result?.athleteId).toBe("user-abc");
		expect(result?.returnTo).toBeUndefined();
	});

	it("verifies a valid state with returnTo", () => {
		const state = createOAuthState("user-abc", "https://jpx.nu/workout/settings");
		const result = verifyOAuthState(state);
		expect(result).not.toBeNull();
		expect(result?.athleteId).toBe("user-abc");
		expect(result?.returnTo).toBe("https://jpx.nu/workout/settings");
	});

	it("returns null for tampered state", () => {
		const state = createOAuthState("user-abc");
		// Flip a character in the middle of the base64 string
		const tampered = `${state.slice(0, 10)}X${state.slice(11)}`;
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
		const nowSpy = vi.spyOn(Date, "now");
		nowSpy.mockReturnValue(Date.now() + elevenMinutesMs);

		const result = verifyOAuthState(state);
		expect(result).toBeNull();
	});

	it("verifies a state within the 10-min window", () => {
		const state = createOAuthState("user-abc");
		const nineMinutesMs = 9 * 60 * 1000;
		const nowSpy = vi.spyOn(Date, "now");
		nowSpy.mockReturnValue(Date.now() + nineMinutesMs);

		const result = verifyOAuthState(state);
		expect(result).not.toBeNull();
		expect(result?.athleteId).toBe("user-abc");
	});

	it("fails when signing key differs", () => {
		const state = createOAuthState("user-abc");
		// Change the signing key
		vi.stubEnv("SUPABASE_JWT_SECRET", "different-key");
		const result = verifyOAuthState(state);
		expect(result).toBeNull();
	});

	it("accepts valid legacy-format state payloads", () => {
		const athleteId = "legacy-user";
		const tsBase36 = Date.now().toString(36);
		const hmac = createHmac("sha256", "test-secret-key-for-unit-tests-only")
			.update(`${athleteId}:${tsBase36}`)
			.digest("hex")
			.slice(0, 16);
		const legacy = Buffer.from(`${athleteId}:${tsBase36}:${hmac}`, "utf8").toString("base64url");

		const result = verifyOAuthState(legacy);
		expect(result).toEqual({ athleteId: "legacy-user" });
	});
});
