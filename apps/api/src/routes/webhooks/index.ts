// ============================================================
// Webhook Routes
// Handles incoming webhook events from all fitness platforms.
// Verifies signatures → enqueues for async processing →
// returns 200 immediately to prevent timeouts.
// ============================================================

import { Hono } from "hono";
import type { ProviderName } from "../../services/integrations/types.js";
import { getProvider } from "../../services/integrations/registry.js";
import { enqueueWebhook } from "../../services/integrations/webhook-queue.js";
import { INTEGRATION_CONFIG } from "../../config/integrations.js";

export const webhookRoutes = new Hono();

// ── Generic webhook handler ──
// Verifies signature + enqueues for async processing.
// Returns 200 immediately — actual processing happens in webhook-queue.ts.
async function handleWebhook(
	providerName: ProviderName,
	headers: Record<string, string>,
	body: string,
): Promise<{ status: string; code: number }> {
	const provider = getProvider(providerName);

	// 1. Verify webhook signature/authenticity
	const valid = await provider.verifyWebhook(headers, body);
	if (!valid) {
		console.warn(`[Webhook] Invalid ${providerName} signature`);
		return { status: "invalid_signature", code: 401 };
	}

	// 2. Enqueue for async processing (fire-and-forget)
	const event = JSON.parse(body) as Record<string, unknown>;
	enqueueWebhook(providerName, event);

	return { status: "accepted", code: 200 };
}

// ── Strava Webhooks ──

// POST — activity events (create/update/delete)
webhookRoutes.post("/strava", async (c) => {
	try {
		const body = await c.req.text();
		const parsed = JSON.parse(body) as Record<string, unknown>;

		// Only process activity.create events
		if (
			parsed.object_type !== "activity" ||
			parsed.aspect_type !== "create"
		) {
			return c.json({ status: "ignored" }, 200);
		}

		const headers = Object.fromEntries(c.req.raw.headers.entries());
		const result = await handleWebhook("STRAVA", headers, body);
		return c.json({ status: result.status }, result.code as 200);
	} catch (err) {
		console.error("[Webhook] Strava error:", err);
		return c.json({ status: "error" }, 200); // 200 to prevent retries
	}
});

// GET — Strava webhook subscription validation
webhookRoutes.get("/strava", (c) => {
	const mode = c.req.query("hub.mode");
	const token = c.req.query("hub.verify_token");
	const challenge = c.req.query("hub.challenge");

	if (
		mode === "subscribe" &&
		token === INTEGRATION_CONFIG.STRAVA.verifyToken
	) {
		console.log("[Webhook] Strava subscription verified");
		return c.json({ "hub.challenge": challenge });
	}

	return c.text("Forbidden", 403);
});

// ── Garmin Webhooks ──
webhookRoutes.post("/garmin", async (c) => {
	try {
		const body = await c.req.text();
		const headers = Object.fromEntries(c.req.raw.headers.entries());
		const result = await handleWebhook("GARMIN", headers, body);
		return c.json({ status: result.status }, result.code as 200);
	} catch (err) {
		console.error("[Webhook] Garmin error:", err);
		return c.json({ status: "error" }, 200);
	}
});

// ── Polar Webhooks ──
webhookRoutes.post("/polar", async (c) => {
	try {
		const body = await c.req.text();
		const headers = Object.fromEntries(c.req.raw.headers.entries());
		const result = await handleWebhook("POLAR", headers, body);
		return c.json({ status: result.status }, result.code as 200);
	} catch (err) {
		console.error("[Webhook] Polar error:", err);
		return c.json({ status: "error" }, 200);
	}
});

// ── Wahoo Webhooks ──
webhookRoutes.post("/wahoo", async (c) => {
	try {
		const body = await c.req.text();
		const headers = Object.fromEntries(c.req.raw.headers.entries());
		const result = await handleWebhook("WAHOO", headers, body);
		return c.json({ status: result.status }, result.code as 200);
	} catch (err) {
		console.error("[Webhook] Wahoo error:", err);
		return c.json({ status: "error" }, 200);
	}
});
