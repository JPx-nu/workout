import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { extractClaims, jwtAuth } from "./middleware/auth.js";
import { RATE_LIMITS, rateLimit } from "./middleware/rate-limit.js";
import { aiRoutes } from "./routes/ai/chat.js";
import { plannedWorkoutsRoutes } from "./routes/planned-workouts/index.js";
import { webhookRoutes } from "./routes/webhooks/index.js";

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

// ── Start server ───────────────────────────────────────────────
const port = parseInt(process.env.PORT || "8787");

console.log(`🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon AI API server starting on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});

export default app;
