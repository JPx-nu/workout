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
type PartialAuthContext = Partial<Pick<AuthContext, "clubId" | "role">>;
type AuthLookupTable = "conversations" | "daily_logs" | "injuries" | "training_plans" | "workouts";

const VALID_ROLES = new Set<AuthRole>(["athlete", "coach", "admin", "owner"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLUB_ID_DERIVATION_SOURCES: Array<{
	table: AuthLookupTable;
	orderedBy: string;
}> = [
	{ table: "daily_logs", orderedBy: "log_date" },
	{ table: "workouts", orderedBy: "started_at" },
	{ table: "training_plans", orderedBy: "created_at" },
	{ table: "conversations", orderedBy: "created_at" },
	{ table: "injuries", orderedBy: "created_at" },
];

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

function createAuthLookupClient(userJwt: string) {
	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${userJwt}` },
		},
	});
}

async function deriveClubIdFromOwnedData(
	client: ReturnType<typeof createAuthLookupClient>,
	userId: string,
): Promise<string | null> {
	for (const source of CLUB_ID_DERIVATION_SOURCES) {
		const { data, error } = await client
			.from(source.table)
			.select("club_id")
			.eq("athlete_id", userId)
			.order(source.orderedBy, { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) {
			logger.warn(
				{ userId, table: source.table, reason: error.message },
				"Failed to derive club_id from owned athlete data",
			);
			continue;
		}

		const clubId = (data as { club_id?: unknown } | null)?.club_id;
		if (isValidClubId(clubId)) {
			return clubId;
		}
	}

	return null;
}

async function loadProfileAuthContext(
	userId: string,
	userJwt: string,
): Promise<PartialAuthContext> {
	const client = createAuthLookupClient(userJwt);

	const { data, error } = await client
		.from("profiles")
		.select("club_id, role")
		.eq("id", userId)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load profile auth context: ${error.message}`);
	}

	const profile = data as { club_id?: unknown; role?: unknown } | null;
	const role = isValidRole(profile?.role) ? profile.role : undefined;
	let clubId = isValidClubId(profile?.club_id) ? profile.club_id : undefined;

	if (!clubId) {
		clubId = (await deriveClubIdFromOwnedData(client, userId)) ?? undefined;
		if (clubId) {
			const { error: updateError } = await client
				.from("profiles")
				.update({ club_id: clubId })
				.eq("id", userId);

			if (updateError) {
				logger.warn(
					{ userId, clubId, reason: updateError.message },
					"Failed to backfill missing profile club_id from owned data",
				);
			} else {
				logger.info({ userId, clubId }, "Backfilled missing profile club_id from owned data");
			}
		}
	}

	return {
		...(clubId ? { clubId } : {}),
		...(role ? { role } : {}),
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
	let clubId = isValidClubId(claimClubId) ? claimClubId : undefined;
	let role = isValidRole(claimRole) ? claimRole : undefined;

	if (!clubId || !role) {
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
			if (!clubId && profileAuth.clubId) {
				clubId = profileAuth.clubId;
			}
			if (!role && profileAuth.role) {
				role = profileAuth.role;
			}
			if (clubId || role) {
				logger.info(
					{
						userId,
						resolvedClubIdFromFallback: Boolean(profileAuth.clubId),
						resolvedRoleFromFallback: Boolean(profileAuth.role),
					},
					"Resolved auth context from profile or owned-data fallback",
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

	if (!clubId || !role) {
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

	const auth: AuthContext = {
		userId,
		clubId,
		role,
	};

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
