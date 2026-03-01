// ============================================================
// Garmin OAuth Routes
// Stub — OAuth 1.0a requires business API approval
// ============================================================

import { Hono } from "hono";
import { getAuth } from "../../middleware/auth.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { disconnectProvider } from "../../services/integrations/oauth.js";
import { getProvider } from "../../services/integrations/registry.js";

export const garminRoutes = new Hono();

const provider = getProvider("GARMIN");

garminRoutes.get("/connect", (c) => {
	const _auth = getAuth(c);

	// Garmin requires business API approval
	return c.json(
		{
			error: "Garmin integration requires business API approval",
			status: "pending_approval",
			applyAt: "https://developer.garmin.com/gc-developer-program/",
		},
		503,
	);
});

garminRoutes.get("/callback", async (c) => {
	// TODO: Implement OAuth 1.0a callback when API is approved
	return c.json({ error: "Not yet implemented" }, 501);
});

garminRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "GARMIN" });
});
