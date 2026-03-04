// ============================================================
// Integration Routes — Hono Sub-App
// Mounts per-provider OAuth routes under /api/integrations/*.
// Also provides:
//   GET /api/integrations/status — all connected accounts
//   GET /api/integrations/sync-history — recent sync operations
// ============================================================

import { Hono } from "hono";
import { getAuth } from "../../middleware/auth.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import { getAllProviderNames } from "../../services/integrations/registry.js";
import { getConnectedAccounts } from "../../services/integrations/token-manager.js";
import { garminRoutes } from "./garmin.js";
import { polarRoutes } from "./polar.js";
import { stravaRoutes } from "./strava.js";
import { wahooRoutes } from "./wahoo.js";

export const integrationRoutes = new Hono();

const PROVIDER_META = {
	STRAVA: {
		slug: "strava",
		available: true,
		availabilityReason: null,
		applyUrl: null,
	},
	GARMIN: {
		slug: "garmin",
		available: false,
		availabilityReason: "pending_approval",
		applyUrl: "https://developer.garmin.com/gc-developer-program/",
	},
	POLAR: {
		slug: "polar",
		available: true,
		availabilityReason: null,
		applyUrl: null,
	},
	WAHOO: {
		slug: "wahoo",
		available: true,
		availabilityReason: null,
		applyUrl: null,
	},
} as const;

function getProviderMeta(name: string) {
	const known = PROVIDER_META[name as keyof typeof PROVIDER_META];
	if (known) return known;
	const slug = name.toLowerCase();
	return {
		slug,
		available: false,
		availabilityReason: "not_configured",
		applyUrl: null,
	} as const;
}

// ── Per-provider routes ──
integrationRoutes.route("/strava", stravaRoutes);
integrationRoutes.route("/garmin", garminRoutes);
integrationRoutes.route("/polar", polarRoutes);
integrationRoutes.route("/wahoo", wahooRoutes);

// ── Status endpoint (for Settings page) ──
integrationRoutes.get("/status", async (c) => {
	const auth = getAuth(c);
	const client = createAdminClient();
	const connected = await getConnectedAccounts(auth.userId, client);

	const allProviders = getAllProviderNames();
	const status = allProviders.map((name) => {
		const conn = connected.find((item) => item.provider === name);
		const meta = getProviderMeta(name);
		return {
			provider: name,
			connected: !!conn,
			lastSyncAt: conn?.lastSyncAt || null,
			providerUid: conn?.providerUid || null,
			available: meta.available,
			availabilityReason: meta.availabilityReason,
			applyUrl: meta.applyUrl,
			actions: {
				connect: `/api/integrations/${meta.slug}/connect`,
				disconnect: `/api/integrations/${meta.slug}/disconnect`,
				sync: `/api/integrations/${meta.slug}/sync`,
			},
		};
	});

	// Get pending queue size from DB
	const { count } = await client
		.from("webhook_queue")
		.select("*", { count: "exact", head: true })
		.in("status", ["pending", "processing"]);

	return c.json({
		integrations: status,
		webhookQueueSize: count ?? 0,
	});
});

// ── Sync history endpoint ──
integrationRoutes.get("/sync-history", async (c) => {
	const auth = getAuth(c);
	const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
	const provider = c.req.query("provider");

	const client = createAdminClient();
	let query = client
		.from("sync_history")
		.select("*")
		.eq("athlete_id", auth.userId)
		.order("created_at", { ascending: false })
		.limit(Math.min(limit, 100));

	if (provider) {
		query = query.eq("provider", provider);
	}

	const { data, error } = await query;

	if (error) {
		return c.json({ error: "Failed to fetch sync history" }, 500);
	}

	return c.json({ history: data || [] });
});
