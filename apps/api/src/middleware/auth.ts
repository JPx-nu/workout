/**
 * Auth Middleware — JWT validation using jose JWKS verification
 *
 * Validates Supabase JWTs (ES256) from the Authorization header using
 * the project's JWKS endpoint for public key discovery.
 * Extracts `club_id` and `role` from `app_metadata` custom claims.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';

// ── Types ──────────────────────────────────────────────────────

export interface AuthContext {
    userId: string;
    clubId: string;
    role: 'athlete' | 'coach' | 'admin' | 'owner';
}

// ── JWKS Setup ─────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ykqoeprpbwxkoytaqngf.supabase.co';
const JWKS = createRemoteJWKSet(
    new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

// ── JWT Verification ───────────────────────────────────────────

/**
 * Validates the Supabase JWT using JWKS (ES256 public key verification).
 * Must be applied before `extractClaims`.
 */
export function jwtAuth(): MiddlewareHandler {
    return createMiddleware(async (c, next) => {
        const authHeader = c.req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json({ error: 'Missing or invalid Authorization header' }, 401);
        }

        const token = authHeader.slice(7);

        try {
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: `${SUPABASE_URL}/auth/v1`,
            });

            // Store the payload for downstream middleware
            c.set('jwtPayload', payload);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Token verification failed';
            console.error('JWT verification failed:', message);
            return c.json({ error: 'Invalid or expired token' }, 401);
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
    const payload = c.get('jwtPayload') as Record<string, unknown>;

    if (!payload?.sub) {
        return c.json({ error: 'Missing user ID in token' }, 401);
    }

    const appMetadata = payload.app_metadata as Record<string, string> | undefined;

    const auth: AuthContext = {
        userId: payload.sub as string,
        clubId: appMetadata?.club_id || '00000000-0000-0000-0000-000000000001',
        role: (appMetadata?.role || 'athlete') as AuthContext['role'],
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
