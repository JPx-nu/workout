import type { Context } from "hono";

export interface ProblemDetails {
	type: string;
	title: string;
	status: number;
	detail?: string;
	instance?: string;
	code?: string;
	requestId?: string;
	hint?: string;
	[key: string]: unknown;
}

interface ProblemOptions {
	type?: string;
	detail?: string;
	instance?: string;
	code?: string;
	requestId?: string;
	hint?: string;
	extras?: Record<string, unknown>;
}

export function createProblemDetails(
	status: number,
	title: string,
	options: ProblemOptions = {},
): ProblemDetails {
	return {
		type: options.type ?? "about:blank",
		title,
		status,
		...(options.detail ? { detail: options.detail } : {}),
		...(options.instance ? { instance: options.instance } : {}),
		...(options.code ? { code: options.code } : {}),
		...(options.requestId ? { requestId: options.requestId } : {}),
		...(options.hint ? { hint: options.hint } : {}),
		...(options.extras ?? {}),
	};
}

export function jsonProblem(
	c: Context,
	status: number,
	title: string,
	options: ProblemOptions = {},
): Response {
	const requestId = c.req.header("x-request-id") || options.requestId;
	const problem = createProblemDetails(status, title, {
		...options,
		requestId,
		instance: options.instance ?? c.req.path,
	});

	return new Response(JSON.stringify(problem), {
		status,
		headers: {
			"content-type": "application/problem+json",
		},
	});
}
