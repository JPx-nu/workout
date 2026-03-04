// ============================================================
// Garmin OAuth Routes
// Stub — OAuth 1.0a requires business API approval
// ============================================================

import { Hono } from "hono";
import { jsonProblem } from "../../lib/problem-details.js";
import { getAuth } from "../../middleware/auth.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { disconnectProvider } from "../../services/integrations/oauth.js";
import { getProvider } from "../../services/integrations/registry.js";

export const garminRoutes = new Hono();

const provider = getProvider("GARMIN");

garminRoutes.get("/connect", (c) => {
	const _auth = getAuth(c);

	// Garmin requires business API approval
	return jsonProblem(c, 503, "Service Unavailable", {
		code: "GARMIN_PENDING_APPROVAL",
		detail: "Garmin integration requires business API approval.",
		hint: "Apply via Garmin Developer Program.",
		type: "https://docs.jpx.nu/problems/garmin-pending-approval",
		extras: {
			status: "pending_approval",
			applyAt: "https://developer.garmin.com/gc-developer-program/",
		},
	});
});

garminRoutes.get("/callback", async (c) => {
	// TODO: Implement OAuth 1.0a callback when API is approved
	return jsonProblem(c, 501, "Not Implemented", {
		code: "GARMIN_CALLBACK_NOT_IMPLEMENTED",
		detail: "Garmin OAuth callback is not yet implemented.",
		type: "https://docs.jpx.nu/problems/garmin-callback-not-implemented",
	});
});

garminRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "GARMIN" });
});

garminRoutes.post("/sync", async (c) => {
	const _auth = getAuth(c);
	return jsonProblem(c, 503, "Service Unavailable", {
		code: "GARMIN_SYNC_PENDING_APPROVAL",
		detail: "Garmin sync is unavailable until business API approval is completed.",
		type: "https://docs.jpx.nu/problems/garmin-sync-pending-approval",
	});
});
