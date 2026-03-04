// ============================================================
// Zod Validation Helper for Hono
// Parses request body against a Zod schema, returns 400 on failure.
// ============================================================

import type { Context } from "hono";
import type { z } from "zod/v4";
import { jsonProblem } from "../lib/problem-details.js";

/**
 * Validate the JSON request body against a Zod schema.
 * Returns the parsed data on success, or a 400 Response on failure.
 */
export async function parseBody<T extends z.ZodType>(
	c: Context,
	schema: T,
): Promise<z.infer<T> | Response> {
	const body = await c.req
		.json()
		.catch((err: unknown) => (err instanceof SyntaxError ? null : Promise.reject(err)));

	if (body === null) {
		return jsonProblem(c, 400, "Bad Request", {
			code: "INVALID_JSON_BODY",
			detail: "Request body is not valid JSON.",
			type: "https://docs.jpx.nu/problems/invalid-json-body",
		});
	}

	const result = schema.safeParse(body);

	if (!result.success) {
		return jsonProblem(c, 400, "Bad Request", {
			code: "VALIDATION_FAILED",
			detail: "Request body failed validation.",
			extras: {
				issues: result.error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			},
			type: "https://docs.jpx.nu/problems/validation-failed",
		});
	}

	return result.data as z.infer<T>;
}

/**
 * Type guard to check if parseBody returned a Response (validation error).
 */
export function isResponse(value: unknown): value is Response {
	return value instanceof Response;
}
