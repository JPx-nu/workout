// ============================================================
// Wahoo OAuth Routes
// /api/integrations/wahoo/connect, /callback, /disconnect, /sync
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

export const wahooRoutes = new Hono();

const provider = getProvider("WAHOO");

wahooRoutes.get("/connect", (c) => {
	const auth = getAuth(c);
	return c.redirect(buildAuthorizationUrl(provider, auth.userId));
});

wahooRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider, "wahoo", c));

wahooRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "WAHOO" });
});

wahooRoutes.post("/sync", (c) => handleProviderSync(provider, "WAHOO", c));
