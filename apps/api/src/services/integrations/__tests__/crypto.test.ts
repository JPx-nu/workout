import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "../crypto.js";

// Use a stable 32-byte hex key for tests (64 hex chars)
const TEST_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("encryptToken / decryptToken", () => {
    it("round-trips a simple token", () => {
        const original = "ya29.access-token-here";
        const encrypted = encryptToken(original);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(original);
    });

    it("round-trips an empty string", () => {
        const encrypted = encryptToken("");
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe("");
    });

    it("round-trips JSON tokens", () => {
        const token = JSON.stringify({ access: "abc", refresh: "xyz" });
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
    });

    it("produces different ciphertexts for same plaintext (random IV)", () => {
        const token = "same-token";
        const a = encryptToken(token);
        const b = encryptToken(token);
        expect(a).not.toBe(b);
        // But both decrypt to the same value
        expect(decryptToken(a)).toBe(token);
        expect(decryptToken(b)).toBe(token);
    });

    it("throws on tampered ciphertext", () => {
        const encrypted = encryptToken("sensitive");
        // Flip a byte in the middle
        const buf = Buffer.from(encrypted, "base64");
        buf[buf.length - 5] ^= 0xff;
        const tampered = buf.toString("base64");
        expect(() => decryptToken(tampered)).toThrow();
    });

    it("throws on wrong key", () => {
        const encrypted = encryptToken("secret");
        // Change the encryption key
        vi.stubEnv(
            "INTEGRATION_ENCRYPTION_KEY",
            "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        );
        expect(() => decryptToken(encrypted)).toThrow();
    });
});

describe("isEncrypted", () => {
    it("returns true for an encrypted token", () => {
        const encrypted = encryptToken("test-token");
        expect(isEncrypted(encrypted)).toBe(true);
    });

    it("returns false for a plaintext token", () => {
        expect(isEncrypted("ya29.some-plaintext-token")).toBe(false);
    });

    it("returns false for short strings", () => {
        expect(isEncrypted("short")).toBe(false);
        expect(isEncrypted("")).toBe(false);
    });

    it("returns false for non-base64 strings", () => {
        expect(isEncrypted("not!valid@base64#")).toBe(false);
    });
});

describe("fallback key derivation", () => {
    it("uses JWT_SECRET when no encryption key is set", () => {
        vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", "");
        vi.stubEnv("SUPABASE_JWT_SECRET", "my-jwt-secret");

        const encrypted = encryptToken("fallback-test");
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe("fallback-test");
    });
});
