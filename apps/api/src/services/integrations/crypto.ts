// ============================================================
// Token Encryption — AES-256-GCM at Rest
// Encrypts OAuth tokens before DB storage.
// Uses 12-byte IV + 16-byte auth tag per best practices.
// ============================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM (NIST recommended)
const TAG_LENGTH = 16; // 128-bit auth tag

function getEncryptionKey(): Buffer {
	const keyHex = process.env.INTEGRATION_ENCRYPTION_KEY;
	if (!keyHex || keyHex.length !== 64) {
		// In development, derive a key from JWT_SECRET
		const fallback = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "dev-key";
		// SHA-256 of the secret gives us exactly 32 bytes
		return createHash("sha256").update(fallback).digest();
	}
	return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext token for storage.
 * Output format: base64(iv + ciphertext + tag)
 */
export function encryptToken(plaintext: string): string {
	const key = getEncryptionKey();
	const iv = randomBytes(IV_LENGTH);

	const cipher = createCipheriv(ALGORITHM, key, iv, {
		authTagLength: TAG_LENGTH,
	});

	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

	const tag = cipher.getAuthTag();

	// Concatenate: iv(12) + ciphertext(variable) + tag(16)
	const combined = Buffer.concat([iv, encrypted, tag]);
	return combined.toString("base64");
}

/**
 * Decrypt an encrypted token from storage.
 * Throws if tampered or wrong key.
 */
export function decryptToken(encrypted: string): string {
	const key = getEncryptionKey();
	const combined = Buffer.from(encrypted, "base64");

	// Extract components
	const iv = combined.subarray(0, IV_LENGTH);
	const tag = combined.subarray(combined.length - TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv, {
		authTagLength: TAG_LENGTH,
	});
	decipher.setAuthTag(tag);

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

	return decrypted.toString("utf8");
}

/**
 * Check if a value looks like an encrypted token (base64 of iv+ct+tag).
 * Used for migration: if token is already encrypted, don't double-encrypt.
 */
export function isEncrypted(value: string): boolean {
	try {
		const buf = Buffer.from(value, "base64");
		// Minimum: 12 (iv) + 1 (ciphertext) + 16 (tag) = 29 bytes
		return buf.length >= 29 && value === buf.toString("base64");
	} catch {
		return false;
	}
}
