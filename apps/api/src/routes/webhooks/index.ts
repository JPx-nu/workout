import { Hono } from "hono";

export const webhookRoutes = new Hono();

// Garmin Health API webhook
webhookRoutes.post("/garmin/activities", async (c) => {
	// TODO: Phase 2 — Validate Garmin signature, normalize, store
	const payload = await c.req.json();
	console.log("[Webhook] Garmin activity received:", payload);
	return c.json({ status: "received", source: "garmin" }, 201);
});

// Polar AccessLink webhook
webhookRoutes.post("/polar/activities", async (c) => {
	// TODO: Phase 2 — Validate Polar token, normalize, store
	const payload = await c.req.json();
	console.log("[Webhook] Polar activity received:", payload);
	return c.json({ status: "received", source: "polar" }, 201);
});

// Wahoo Cloud API webhook
webhookRoutes.post("/wahoo/activities", async (c) => {
	// TODO: Phase 2 — Validate Wahoo signature, normalize, store
	const payload = await c.req.json();
	console.log("[Webhook] Wahoo activity received:", payload);
	return c.json({ status: "received", source: "wahoo" }, 201);
});

// FORM Swim webhook
webhookRoutes.post("/form/activities", async (c) => {
	// TODO: Phase 2 — Validate FORM payload, normalize, store
	const payload = await c.req.json();
	console.log("[Webhook] FORM swim data received:", payload);
	return c.json({ status: "received", source: "form" }, 201);
});
