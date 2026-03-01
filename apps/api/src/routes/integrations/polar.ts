// ============================================================
// Polar OAuth Routes
// /api/integrations/polar/connect, /callback, /disconnect, /sync
// ============================================================

import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { getAuth } from "../../middleware/auth.js";

const log = createLogger({ module: "polar-routes" });

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

export const polarRoutes = new Hono();

const provider = getProvider("POLAR");

const syncCooldown = new Map<string, number>();
const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

polarRoutes.get("/connect", (c) => {
	const auth = getAuth(c);
	const url = buildAuthorizationUrl(provider, auth.userId);
	return c.redirect(url);
});

polarRoutes.get("/callback", async (c) => {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const error = c.req.query("error");

	if (error || !code || !state) {
		const webUrl = process.env.WEB_URL || "http://localhost:3000";
		return c.redirect(`${webUrl}/workout/settings?integration=polar&error=denied`);
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

		const webUrl = process.env.WEB_URL || "http://localhost:3000";
		return c.redirect(`${webUrl}/workout/settings?integration=polar&status=connected`);
	} catch (err) {
		log.error({ err }, "OAuth callback failed");
		const webUrl = process.env.WEB_URL || "http://localhost:3000";
		return c.redirect(`${webUrl}/workout/settings?integration=polar&error=failed`);
	}
});

polarRoutes.post("/disconnect", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	await disconnectProvider(provider, auth.userId, client);
	return c.json({ status: "disconnected", provider: "POLAR" });
});

polarRoutes.post("/sync", async (c) => {
	const auth = getAuth(c);

	const lastSync = syncCooldown.get(auth.userId) || 0;
	if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
		const waitSec = Math.ceil((SYNC_COOLDOWN_MS - (Date.now() - lastSync)) / 1000);
		return c.json({ error: `Please wait ${waitSec}s before syncing again` }, 429);
	}

	const client = createAdminClient();
	const connection = await getActiveConnection("POLAR", auth.userId, client);

	if (!connection) {
		return c.json({ error: "Polar not connected" }, 400);
	}

	syncCooldown.set(auth.userId, Date.now());

	const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const activities = await provider.fetchActivities(connection.accessToken, since);

	const healthData = provider.fetchHealthData
		? await provider.fetchHealthData(connection.accessToken, new Date())
		: [];

	const result = await normalizeAndStore(activities, healthData, auth.userId, auth.clubId, client);

	await client
		.from("connected_accounts")
		.update({ last_sync_at: new Date().toISOString() })
		.eq("id", connection.account.id);

	return c.json({
		status: "synced",
		workoutsInserted: result.workoutsInserted,
		workoutsSkipped: result.workoutsSkipped,
		metricsInserted: result.metricsInserted,
	});
});
