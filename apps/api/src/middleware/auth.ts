/**
 * Auth Middleware — JWT validation using jose JWKS verification
 *
 * Validates Supabase JWTs (ES256) from the Authorization header using
 * the project's JWKS endpoint for public key discovery.
 * Extracts `club_id` and `role` from `app_metadata` custom claims.
 */

import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "../lib/logger.js";
import { jsonProblem } from "../lib/problem-details.js";

// ── Types ──────────────────────────────────────────────────────

export interface AuthContext {
	userId: string;
	clubId: string;
	role: "athlete" | "coach" | "admin" | "owner";
}

const VALID_ROLES = new Set<AuthContext["role"]>(["athlete", "coach", "admin", "owner"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── JWKS Setup ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
	throw new Error("SUPABASE_URL environment variable is required");
}
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

// ── JWT Verification ───────────────────────────────────────────

/**
 * Validates the Supabase JWT using JWKS (ES256 public key verification).
 * Must be applied before `extractClaims`.
 */
export function jwtAuth(): MiddlewareHandler {
	return createMiddleware(async (c, next) => {
		const authHeader = c.req.header("Authorization");

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return jsonProblem(c, 401, "Unauthorized", {
				code: "AUTH_HEADER_INVALID",
				detail: "Missing or invalid Authorization header.",
				hint: "Provide a valid Bearer token.",
				type: "https://docs.jpx.nu/problems/auth-header-invalid",
			});
		}

		const token = authHeader.slice(7);

		try {
			const { payload } = await jwtVerify(token, JWKS, {
				issuer: `${SUPABASE_URL}/auth/v1`,
			});

			// Store the raw JWT and payload for downstream middleware
			c.set("jwt", token);
			c.set("jwtPayload", payload);
		} catch (err) {
			const message = err instanceof Error ? err.message : "Token verification failed";
			logger.warn({ reason: message }, "JWT verification failed");
			return jsonProblem(c, 401, "Unauthorized", {
				code: "TOKEN_INVALID",
				detail: "Token is invalid or expired.",
				hint: "Re-authenticate and retry the request.",
				type: "https://docs.jpx.nu/problems/token-invalid",
			});
		}

		await next();
	});
}

// ── Claims Extraction ──────────────────────────────────────────

/**
 * Extracts `club_id` and `role` from the validated JWT's `app_metadata`
 * and sets them as Hono context variables.
 *
 * Must be used after `jwtAuth()`.
 *
 * Usage in routes:
 *   const auth = getAuth(c);
 *   const { userId, clubId, role } = auth;
 */
export const extractClaims = createMiddleware(async (c, next) => {
	const payload = c.get("jwtPayload") as Record<string, unknown>;

	if (!payload?.sub) {
		return jsonProblem(c, 401, "Unauthorized", {
			code: "TOKEN_SUB_MISSING",
			detail: "Missing user ID claim in token.",
			type: "https://docs.jpx.nu/problems/token-sub-missing",
		});
	}

	const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
	const clubId = appMetadata?.club_id;
	const role = appMetadata?.role;

	if (typeof clubId !== "string" || !UUID_PATTERN.test(clubId)) {
		logger.warn({ userId: payload.sub }, "JWT missing valid app_metadata.club_id");
		return jsonProblem(c, 401, "Unauthorized", {
			code: "CLAIM_CLUB_ID_MISSING",
			detail: "Missing required claim: app_metadata.club_id",
			type: "https://docs.jpx.nu/problems/claim-club-id-missing",
		});
	}

	if (typeof role !== "string" || !VALID_ROLES.has(role as AuthContext["role"])) {
		logger.warn({ userId: payload.sub, role }, "JWT missing valid app_metadata.role");
		return jsonProblem(c, 401, "Unauthorized", {
			code: "CLAIM_ROLE_MISSING",
			detail: "Missing required claim: app_metadata.role",
			type: "https://docs.jpx.nu/problems/claim-role-missing",
		});
	}

	const auth: AuthContext = {
		userId: payload.sub as string,
		clubId,
		role: role as AuthContext["role"],
	};

	c.set("auth", auth);
	await next();
});

// ── Helper ─────────────────────────────────────────────────────

/**
 * Retrieves the authenticated user context from a Hono request.
 * Throws if auth middleware hasn't run (programming error).
 */
export function getAuth(c: Context): AuthContext {
	const auth = c.get("auth") as AuthContext | undefined;
	if (!auth) {
		throw new Error("getAuth() called without auth middleware — check route middleware stack");
	}
	return auth;
}

/**
 * Retrieves the raw JWT from a Hono request (set by jwtAuth middleware).
 * Use this to create user-scoped Supabase clients.
 */
export function getJwt(c: Context): string {
	return (c.get("jwt") as string) || "";
}
