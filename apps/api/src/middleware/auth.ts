/**
 * Auth middleware: JWKS-backed JWT verification plus app-specific auth context.
 *
 * Supabase access tokens are verified via JWKS. We prefer `app_metadata.club_id`
 * and `app_metadata.role` when present, but some live sessions can lag behind the
 * latest custom claims. In that case, fall back to the authenticated `profiles`
 * row so valid sessions do not fail with a 401 during AI/API requests.
 */

import { createClient } from "@supabase/supabase-js";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "../lib/logger.js";
import { jsonProblem } from "../lib/problem-details.js";

export interface AuthContext {
	userId: string;
	clubId: string;
	role: "athlete" | "coach" | "admin" | "owner";
}

type AuthRole = AuthContext["role"];

const VALID_ROLES = new Set<AuthRole>(["athlete", "coach", "admin", "owner"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
	throw new Error("SUPABASE_URL environment variable is required");
}
const SUPABASE_URL = supabaseUrl;

const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
	throw new Error("SUPABASE_ANON_KEY environment variable is required");
}
const SUPABASE_ANON_KEY = supabaseAnonKey;

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

function isValidClubId(value: unknown): value is string {
	return typeof value === "string" && UUID_PATTERN.test(value);
}

function isValidRole(value: unknown): value is AuthRole {
	return typeof value === "string" && VALID_ROLES.has(value as AuthRole);
}

async function loadProfileAuthContext(
	userId: string,
	userJwt: string,
): Promise<Pick<AuthContext, "clubId" | "role"> | null> {
	const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${userJwt}` },
		},
	});

	const { data, error } = await client
		.from("profiles")
		.select("club_id, role")
		.eq("id", userId)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load profile auth context: ${error.message}`);
	}

	const profile = data as { club_id?: unknown; role?: unknown } | null;
	if (!profile || !isValidClubId(profile.club_id) || !isValidRole(profile.role)) {
		return null;
	}

	return {
		clubId: profile.club_id,
		role: profile.role,
	};
}

/**
 * Validates the Supabase JWT using JWKS public key verification.
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

/**
 * Resolves app-specific auth context from token claims first, then from the
 * authenticated profile row if the token is valid but the custom claims are stale.
 *
 * Must be used after `jwtAuth()`.
 */
export const extractClaims = createMiddleware(async (c, next) => {
	const payload = c.get("jwtPayload") as Record<string, unknown>;
	const token = c.get("jwt") as string | undefined;

	if (!payload?.sub) {
		return jsonProblem(c, 401, "Unauthorized", {
			code: "TOKEN_SUB_MISSING",
			detail: "Missing user ID claim in token.",
			type: "https://docs.jpx.nu/problems/token-sub-missing",
		});
	}

	const userId = payload.sub as string;
	const appMetadata = payload.app_metadata as Record<string, unknown> | undefined;
	const claimClubId = appMetadata?.club_id;
	const claimRole = appMetadata?.role;

	let auth: AuthContext | null =
		isValidClubId(claimClubId) && isValidRole(claimRole)
			? {
					userId,
					clubId: claimClubId,
					role: claimRole,
				}
			: null;

	if (!auth) {
		if (!token) {
			logger.error({ userId }, "Auth middleware missing raw JWT for profile fallback");
			return jsonProblem(c, 500, "Internal Server Error", {
				code: "AUTH_CONTEXT_LOOKUP_FAILED",
				detail: "The server could not complete the authentication lookup.",
				type: "https://docs.jpx.nu/problems/auth-context-lookup-failed",
			});
		}

		try {
			const profileAuth = await loadProfileAuthContext(userId, token);
			if (profileAuth) {
				auth = {
					userId,
					clubId: profileAuth.clubId,
					role: profileAuth.role,
				};
				logger.info(
					{
						userId,
						missingClubIdClaim: !isValidClubId(claimClubId),
						missingRoleClaim: !isValidRole(claimRole),
					},
					"Resolved auth context from profile fallback",
				);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Profile auth context lookup failed";
			logger.error({ message, userId }, "Failed to resolve auth context from profile");
			return jsonProblem(c, 500, "Internal Server Error", {
				code: "AUTH_CONTEXT_LOOKUP_FAILED",
				detail: "The server could not resolve the authenticated user context.",
				type: "https://docs.jpx.nu/problems/auth-context-lookup-failed",
			});
		}
	}

	if (!auth) {
		logger.warn(
			{
				userId,
				missingClubIdClaim: !isValidClubId(claimClubId),
				missingRoleClaim: !isValidRole(claimRole),
			},
			"Authenticated user is missing both JWT and profile auth context",
		);
		return jsonProblem(c, 401, "Unauthorized", {
			code: "AUTH_CONTEXT_MISSING",
			detail: "The authenticated user is missing required club or role context.",
			hint: "Refresh your session or complete profile setup, then retry.",
			type: "https://docs.jpx.nu/problems/auth-context-missing",
		});
	}

	c.set("auth", auth);
	await next();
});

/**
 * Retrieves the authenticated user context from a Hono request.
 * Throws if auth middleware has not run.
 */
export function getAuth(c: Context): AuthContext {
	const auth = c.get("auth") as AuthContext | undefined;
	if (!auth) {
		throw new Error("getAuth() called without auth middleware; check route middleware stack");
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
