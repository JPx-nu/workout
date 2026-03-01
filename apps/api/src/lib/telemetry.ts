// ============================================================
// OpenTelemetry Bootstrap — MUST be imported before all other modules
// Initializes tracing, HTTP instrumentation, and GenAI spans.
// ============================================================

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const provider = new NodeTracerProvider({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "triathlon-ai-api",
		[ATTR_SERVICE_VERSION]: "0.1.0",
		"deployment.environment": process.env.NODE_ENV ?? "development",
	}),
	spanProcessors: [
		new BatchSpanProcessor(
			new OTLPTraceExporter({
				url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
			}),
		),
	],
});

provider.register();

registerInstrumentations({
	instrumentations: [
		new HttpInstrumentation({
			ignoreIncomingRequestHook: (req) => req.url === "/health",
			requestHook: (span, request) => {
				const headers = "headers" in request ? request.headers : undefined;
				const requestId =
					headers && typeof headers === "object" && "x-request-id" in headers
						? String(headers["x-request-id"])
						: "";
				if (requestId) {
					span.setAttribute("http.request.id", requestId);
				}
			},
		}),
	],
});

process.on("SIGTERM", () => provider.shutdown());

export { provider };
