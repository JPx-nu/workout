// ============================================================
// Polar OAuth Routes
// /api/integrations/polar/connect, /callback, /disconnect, /sync
// ============================================================

import { Hono } from "hono";
import { getAuth } from "../../middleware/auth.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import {
	buildAuthorizationUrl,
	disconnectProvider,
	handleProviderOAuthCallback,
	handleProviderSync,
} from "../../services/integrations/oauth.js";
import { getProvider } from "../../services/integrations/registry.js";

export const polarRoutes = new Hono();

const provider = getProvider("POLAR");

polarRoutes.get("/connect", (c) => {
	const auth = getAuth(c);
	return c.redirect(buildAuthorizationUrl(provider, auth.userId));
});

polarRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider, "polar", c));

polarRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "POLAR" });
});

polarRoutes.post("/sync", (c) => handleProviderSync(provider, "POLAR", c));
