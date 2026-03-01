// OTel MUST be imported before all other modules
import "./lib/telemetry.js";

import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "./lib/logger.js";
import { extractClaims, jwtAuth } from "./middleware/auth.js";
import { RATE_LIMITS, rateLimit } from "./middleware/rate-limit.js";
import { aiRoutes } from "./routes/ai/chat.js";
import { aiStreamRoutes } from "./routes/ai/stream.js";
import { integrationRoutes } from "./routes/integrations/index.js";
import { plannedWorkoutsRoutes } from "./routes/planned-workouts/index.js";
import { webhookRoutes } from "./routes/webhooks/index.js";
import { stopPolling } from "./services/integrations/webhook-queue.js";

const app = new OpenAPIHono();

// ── Global error handler ───────────────────────────────────────
app.onError((err, c) => {
	logger.error({ err, path: c.req.path, method: c.req.method }, "Unhandled error");
	return c.json(
		{
			error: err.message || "Internal Server Error",
			stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
		},
		500,
	);
});

// ── Global middleware ──────────────────────────────────────────
app.use("*", secureHeaders());
app.use(
	"*",
	cors({
		origin: (origin) => {
			// Allow any localhost origin in development (Next.js, Flutter web, etc.)
			if (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
				return origin;
			}
			// Allow configured WEB_URL and Azure production domain
			const allowed = [
				process.env.WEB_URL,
				"https://jpx-workout-web.azurewebsites.net",
				"https://jpx.nu",
			].filter(Boolean) as string[];
			if (origin && allowed.includes(origin)) {
				return origin;
			}
			return allowed[0] || "http://localhost:3000";
		},
		credentials: true,
	}),
);

// ── Request body size limits ───────────────────────────────────
// Default 2 MB for general API routes
app.use("/api/*", bodyLimit({ maxSize: 2 * 1024 * 1024 }));
// AI chat supports image uploads — allow up to 12 MB
app.use("/api/ai/*", bodyLimit({ maxSize: 12 * 1024 * 1024 }));

// ── Health check (public) ──────────────────────────────────────
app.get("/health", (c) =>
	c.json({
		status: "ok",
		version: "0.1.0",
		timestamp: new Date().toISOString(),
		runtime: `Node.js ${process.version}`,
	}),
);

// ── Webhook routes (signature-verified, no JWT) ────────────────
app.route("/webhooks", webhookRoutes);

// ── Protected API routes ───────────────────────────────────────
// JWT auth + claims extraction for all /api/* routes
app.use("/api/*", jwtAuth(), extractClaims);

// Rate limiting for AI endpoints
app.use("/api/ai/*", rateLimit(RATE_LIMITS.aiChat));

// Route groups — chained for Hono RPC type inference
const routes = app
	.route("/api/ai", aiRoutes)
	.route("/api/ai", aiStreamRoutes)
	.route("/api/planned-workouts", plannedWorkoutsRoutes)
	.route("/api/integrations", integrationRoutes);

// ── OpenAPI documentation ──────────────────────────────────────
app.doc("/api/doc", {
	openapi: "3.1.0",
	info: {
		title: "Triathlon AI Coaching API",
		version: "0.1.0",
		description: "REST API for the triathlon AI coaching platform",
	},
});

app.get("/api/reference", swaggerUI({ url: "/api/doc" }));

// ── Start server ───────────────────────────────────────────────
const port = parseInt(process.env.PORT || "8787", 10);

logger.info({ port }, "Triathlon AI API server starting");

const server = serve({
	fetch: app.fetch,
	port,
});

// ── Graceful shutdown ──────────────────────────────────────────
// Ensures in-flight requests complete before Azure restarts the process
function shutdown(signal: string) {
	logger.info({ signal }, "Shutdown signal received — closing gracefully");
	stopPolling();
	server.close(() => {
		logger.info("Server closed");
		process.exit(0);
	});
	// Force exit after 10s if connections don't drain
	setTimeout(() => {
		logger.warn("Forced shutdown after 10s timeout");
		process.exit(1);
	}, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Export for Hono RPC client type inference
export type AppType = typeof routes;
export default app;
