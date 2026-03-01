// ============================================================
// Zod Validation Helper for Hono
// Parses request body against a Zod schema, returns 400 on failure.
// ============================================================

import type { Context } from "hono";
import type { z } from "zod/v4";

/**
 * Validate the JSON request body against a Zod schema.
 * Returns the parsed data on success, or a 400 Response on failure.
 */
export async function parseBody<T extends z.ZodType>(
	c: Context,
	schema: T,
): Promise<z.infer<T> | Response> {
	const body = await c.req.json().catch(() => null);

	if (body === null) {
		return c.json({ error: "Invalid JSON body" }, 400);
	}

	const result = schema.safeParse(body);

	if (!result.success) {
		return c.json(
			{
				error: "Validation failed",
				issues: result.error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			},
			400,
		);
	}

	return result.data as z.infer<T>;
}

/**
 * Type guard to check if parseBody returned a Response (validation error).
 */
export function isResponse(value: unknown): value is Response {
	return value instanceof Response;
}
