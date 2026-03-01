// ============================================================
// Wahoo OAuth Routes
// /api/integrations/wahoo/connect, /callback, /disconnect, /sync
// ============================================================

import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { getAuth } from "../../middleware/auth.js";

const log = createLogger({ module: "wahoo-routes" });

import { INTEGRATION_CONFIG } from "../../config/integrations.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { normalizeAndStore } from "../../services/integrations/normalizer.js";
import {
	buildAuthorizationUrl,
	disconnectProvider,
	handleOAuthCallback,
	verifyCallbackState,
} from "../../services/integrations/oauth.js";
import { getProvider } from "../../services/integrations/registry.js";
import { getActiveConnection } from "../../services/integrations/token-manager.js";

export const wahooRoutes = new Hono();

const provider = getProvider("WAHOO");

const syncCooldown = new Map<string, number>();

wahooRoutes.get("/connect", (c) => {
	const auth = getAuth(c);
	const url = buildAuthorizationUrl(provider, auth.userId);
	return c.redirect(url);
});

wahooRoutes.get("/callback", async (c) => {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");

	if (error || !code || !state) {
		const webUrl = INTEGRATION_CONFIG.webUrl;
		return c.redirect(`${webUrl}/workout/settings?integration=wahoo&error=denied`);
	}

	try {
		const athleteId = verifyCallbackState(provider, state);
		const client = createAdminClient();
		const { data: profile } = await client
			.from("profiles")
			.select("club_id")
			.eq("id", athleteId)
			.single();

		if (!profile) return c.json({ error: "Athlete not found" }, 404);

		await handleOAuthCallback(provider, code, athleteId, profile.club_id, client);

		const webUrl = INTEGRATION_CONFIG.webUrl;
		return c.redirect(`${webUrl}/workout/settings?integration=wahoo&status=connected`);
	} catch (err) {
		log.error({ err }, "OAuth callback failed");
		const webUrl = INTEGRATION_CONFIG.webUrl;
		return c.redirect(`${webUrl}/workout/settings?integration=wahoo&error=failed`);
	}
});

wahooRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "WAHOO" });
});

wahooRoutes.post("/sync", async (c) => {
	const auth = getAuth(c);

	const lastSync = syncCooldown.get(auth.userId) || 0;
	if (Date.now() - lastSync < INTEGRATION_CONFIG.syncCooldownMs) {
		const waitSec = Math.ceil((INTEGRATION_CONFIG.syncCooldownMs - (Date.now() - lastSync)) / 1000);
		return c.json({ error: `Please wait ${waitSec}s before syncing again` }, 429);
	}

	const client = createAdminClient();
	const connection = await getActiveConnection("WAHOO", auth.userId, client);

	if (!connection) {
		return c.json({ error: "Wahoo not connected" }, 400);
	}

	syncCooldown.set(auth.userId, Date.now());

	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const activities = await provider.fetchActivities(connection.accessToken, since);

	const result = await normalizeAndStore(activities, [], auth.userId, auth.clubId, client);

	await client
		.from("connected_accounts")
		.update({ last_sync_at: new Date().toISOString() })
		.eq("id", connection.account.id);

	return c.json({
		status: "synced",
		workoutsInserted: result.workoutsInserted,
		workoutsSkipped: result.workoutsSkipped,
	});
});
