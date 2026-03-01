// ============================================================
// Strava OAuth Routes
// /api/integrations/strava/connect — redirect to Strava
// /api/integrations/strava/callback — handle OAuth callback
// /api/integrations/strava/disconnect — revoke + delete
// /api/integrations/strava/sync — manual sync trigger
//
// Security: HMAC-signed state, encrypted tokens
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

export const stravaRoutes = new Hono();

const provider = getProvider("STRAVA");

stravaRoutes.get("/connect", (c) => {
	const auth = getAuth(c);
	return c.redirect(buildAuthorizationUrl(provider, auth.userId));
});

stravaRoutes.get("/callback", (c) => handleProviderOAuthCallback(provider, "strava", c));

stravaRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "STRAVA" });
});

stravaRoutes.post("/sync", (c) => handleProviderSync(provider, "STRAVA", c));
