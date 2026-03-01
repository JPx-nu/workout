// ============================================================
// Structured Logger — Pino with OpenTelemetry trace correlation
// ============================================================

import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	transport:
		process.env.NODE_ENV === "development"
			? {
					target: "pino/file",
					options: { destination: 1 }, // stdout
				}
			: undefined,
	formatters: {
		level(label) {
			return { level: label };
		},
	},
	timestamp: pino.stdTimeFunctions.isoTime,
});

/** Create a child logger with contextual bindings */
export function createLogger(context: Record<string, unknown>) {
	return logger.child(context);
}
