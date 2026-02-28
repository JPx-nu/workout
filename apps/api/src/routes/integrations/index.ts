// ============================================================
// Integration Routes — Hono Sub-App
// Mounts per-provider OAuth routes under /api/integrations/*.
// Also provides:
//   GET /api/integrations/status — all connected accounts
//   GET /api/integrations/sync-history — recent sync operations
// ============================================================

import { Hono } from "hono";
import { stravaRoutes } from "./strava.js";
import { garminRoutes } from "./garmin.js";
import { polarRoutes } from "./polar.js";
import { wahooRoutes } from "./wahoo.js";
import { getAuth } from "../../middleware/auth.js";
import { getConnectedAccounts } from "../../services/integrations/token-manager.js";
import { getAllProviderNames } from "../../services/integrations/registry.js";
import { getQueueSize } from "../../services/integrations/webhook-queue.js";
import { createAdminClient } from "../../services/ai/supabase.js";

export const integrationRoutes = new Hono();

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
        return {
            provider: name,
            connected: !!conn,
            lastSyncAt: conn?.lastSyncAt || null,
            providerUid: conn?.providerUid || null,
        };
    });

    return c.json({
        integrations: status,
        webhookQueueSize: getQueueSize(),
    });
});

// ── Sync history endpoint ──
integrationRoutes.get("/sync-history", async (c) => {
    const auth = getAuth(c);
    const limit = parseInt(c.req.query("limit") || "20", 10);
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
