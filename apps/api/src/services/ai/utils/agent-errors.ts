/**
 * Agent Error Utilities — shared error classification for AI routes.
 *
 * Used by both the SSE chat endpoint and the AI SDK stream endpoint
 * to produce consistent, user-friendly error messages.
 */

export function isGraphRecursionError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return err.name === "GraphRecursionError" || err.message.includes("GRAPH_RECURSION_LIMIT");
}

export function isAbortError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return err.name === "AbortError";
}

export function getAgentErrorMessage(err: unknown): string {
	if (isAbortError(err)) {
		return "I'm taking too long on this one. Please try a shorter or more specific question.";
	}
	if (isGraphRecursionError(err)) {
		return "I got stuck in a reasoning loop. Please rephrase and I will answer with a simpler path.";
	}
	return "Sorry, I encountered an error processing your request. Please try again.";
}
