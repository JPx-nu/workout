import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { extractClaims, jwtAuth } from "./middleware/auth.js";
import { RATE_LIMITS, rateLimit } from "./middleware/rate-limit.js";
import { aiRoutes } from "./routes/ai/chat.js";
import { plannedWorkoutsRoutes } from "./routes/planned-workouts/index.js";
import { webhookRoutes } from "./routes/webhooks/index.js";
import { integrationRoutes } from "./routes/integrations/index.js";

const app = new Hono();

// ── Global error handler ───────────────────────────────────────
app.onError((err, c) => {
	console.error("Unhandled error:", err);
	return c.json(
		{
			error: err.message || "Internal Server Error",
			stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
		},
		500,
	);
});

// ── Global middleware ──────────────────────────────────────────
app.use("*", logger());
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

// Route groups
app.route("/api/ai", aiRoutes);
app.route("/api/planned-workouts", plannedWorkoutsRoutes);
app.route("/api/integrations", integrationRoutes);

// ── Start server ───────────────────────────────────────────────
const port = parseInt(process.env.PORT || "8787");

console.log(`🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon AI API server starting on port ${port}`);

const server = serve({
	fetch: app.fetch,
	port,
});

// ── Graceful shutdown ──────────────────────────────────────────
// Ensures in-flight requests complete before Azure restarts the process
function shutdown(signal: string) {
	console.log(`\n🛑 ${signal} received — shutting down gracefully…`);
	server.close(() => {
		console.log("✅ Server closed. Goodbye.");
		process.exit(0);
	});
	// Force exit after 10s if connections don't drain
	setTimeout(() => {
		console.warn("⚠️  Forced shutdown after 10s timeout");
		process.exit(1);
	}, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;

