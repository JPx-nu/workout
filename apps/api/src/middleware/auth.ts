/**
 * Auth Middleware — JWT validation using Hono's built-in JWT middleware
 *
 * Validates Supabase JWTs from the Authorization header and extracts
 * `club_id` and `role` from `app_metadata` custom claims.
 *
 * @see https://hono.dev/docs/middleware/builtin/jwt
 */

import { jwt } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';

// ── Types ──────────────────────────────────────────────────────

export interface AuthContext {
    userId: string;
    clubId: string;
    role: 'athlete' | 'coach' | 'admin' | 'owner';
}

// ── JWT Verification ───────────────────────────────────────────

/**
 * Validates the Supabase JWT using the shared secret.
 * Must be applied before `extractClaims`.
 */
export function jwtAuth(): MiddlewareHandler {
    const secret = process.env.SUPABASE_JWT_SECRET;

    if (!secret) {
        console.warn('⚠️  SUPABASE_JWT_SECRET not set — JWT auth will reject all requests');
    }

    return jwt({
        secret: secret || 'missing-jwt-secret-will-fail',
        alg: 'HS256',
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
    const payload = c.get('jwtPayload') as Record<string, unknown>;

    if (!payload?.sub) {
        return c.json({ error: 'Missing user ID in token' }, 401);
    }

    const appMetadata = payload.app_metadata as Record<string, string> | undefined;

    if (!appMetadata?.club_id) {
        return c.json({ error: 'Missing club_id in token claims' }, 403);
    }

    const auth: AuthContext = {
        userId: payload.sub as string,
        clubId: appMetadata.club_id,
        role: (appMetadata.role || 'athlete') as AuthContext['role'],
    };

    c.set('auth', auth);
    await next();
});

// ── Helper ─────────────────────────────────────────────────────

/**
 * Retrieves the authenticated user context from a Hono request.
 * Throws if auth middleware hasn't run (programming error).
 */
export function getAuth(c: Context): AuthContext {
    const auth = c.get('auth') as AuthContext | undefined;
    if (!auth) {
        throw new Error('getAuth() called without auth middleware — check route middleware stack');
    }
    return auth;
}
