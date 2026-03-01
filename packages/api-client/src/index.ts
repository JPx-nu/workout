// ============================================================
// Typed API Client — End-to-end type safety via Hono RPC
// Uses Hono's `hc` client with full TypeScript inference from
// the server's exported AppType.
// ============================================================

import type { AppType } from "@triathlon/api";
import { hc } from "hono/client";

export type { AppType };

/**
 * Create a fully typed API client.
 *
 * @example
 * ```ts
 * const api = createApiClient("http://localhost:8787", token);
 * const res = await api.api["planned-workouts"].$get({
 *   query: { from: "2026-03-01", to: "2026-03-07" },
 * });
 * const { data } = await res.json();
 * ```
 */
export function createApiClient(baseUrl: string, token?: string) {
	return hc<AppType>(baseUrl, {
		headers: token ? { Authorization: `Bearer ${token}` } : {},
	});
}
