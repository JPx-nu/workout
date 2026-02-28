// ============================================================
// Wahoo Provider
// Implements IntegrationProvider for Wahoo Cloud API.
// Docs: https://developers.wahooligan.com/
// ============================================================

import type {
    IntegrationProvider,
    OAuthConfig,
    OAuthTokens,
    NormalizedWorkout,
    ActivityType,
} from "../types.js";
import { INTEGRATION_CONFIG } from "../../../config/integrations.js";
import { fetchWithRetry } from "../http.js";
import { ProviderApiError } from "../errors.js";

const WAHOO_API = "https://api.wahooligan.com/v1";

export class WahooProvider implements IntegrationProvider {
    readonly name = "WAHOO" as const;

    readonly oauthConfig: OAuthConfig = {
        authorizeUrl: "https://api.wahooligan.com/oauth/authorize",
        tokenUrl: "https://api.wahooligan.com/oauth/token",
        revokeUrl: "https://api.wahooligan.com/oauth/revoke",
        clientId: INTEGRATION_CONFIG.WAHOO.clientId,
        clientSecret: INTEGRATION_CONFIG.WAHOO.clientSecret,
        scopes: ["user_read", "workouts_read", "offline_data"],
        callbackPath: "/api/integrations/wahoo/callback",
        oauthVersion: "2.0",
    };

    private static readonly ACTIVITY_MAP: Record<string, ActivityType> = {
        running: "RUN",
        cycling: "BIKE",
        swimming: "SWIM",
        strength: "STRENGTH",
        yoga: "YOGA",
    };

    // ── OAuth ──

    buildAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.oauthConfig.clientId,
            response_type: "code",
            redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
            scope: this.oauthConfig.scopes.join(" "),
            state,
        });
        return `${this.oauthConfig.authorizeUrl}?${params}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: this.oauthConfig.clientId,
                client_secret: this.oauthConfig.clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
            }),
        });

        if (!res.ok) {
            throw new ProviderApiError("WAHOO", res.status, "Code exchange failed");
        }

        const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            created_at: number;
        };

        // Fetch user ID
        const userRes = await fetch(`${WAHOO_API}/user`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
        });
        const user = (await userRes.json()) as { id: number };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date((data.created_at + data.expires_in) * 1000),
            providerUserId: String(user.id),
            scopes: this.oauthConfig.scopes,
        };
    }

    async refreshToken(refreshToken: string): Promise<OAuthTokens> {
        const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: this.oauthConfig.clientId,
                client_secret: this.oauthConfig.clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!res.ok) {
            throw new ProviderApiError("WAHOO", res.status, "Token refresh failed");
        }

        const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            created_at: number;
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date((data.created_at + data.expires_in) * 1000),
            providerUserId: "",
            scopes: this.oauthConfig.scopes,
        };
    }

    async revokeAccess(accessToken: string): Promise<void> {
        await fetch(this.oauthConfig.revokeUrl!, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: accessToken,
                client_id: this.oauthConfig.clientId,
                client_secret: this.oauthConfig.clientSecret,
            }),
        });
    }

    // ── Webhooks ──

    verifyWebhook(
        _headers: Record<string, string>,
        _body: string,
    ): boolean {
        // TODO: Verify webhook_token header
        return true;
    }

    extractOwnerIdFromWebhook(event: Record<string, unknown>): string {
        const user = event.user as { id?: number } | undefined;
        return String(user?.id || "");
    }

    extractActivityIdFromWebhook(event: Record<string, unknown>): string {
        const workout = event.workout_summary as { id?: number } | undefined;
        return String(workout?.id || event.id || "");
    }

    // ── Data Fetching ──

    async fetchActivity(
        accessToken: string,
        activityId: string,
    ): Promise<NormalizedWorkout> {
        const res = await fetchWithRetry(
            `${WAHOO_API}/workouts/${activityId}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            },
        );

        if (!res.ok) {
            throw new ProviderApiError("WAHOO", res.status, "fetchActivity failed");
        }

        const data = (await res.json()) as Record<string, unknown>;
        return this.normalizeActivity(data);
    }

    async fetchActivities(
        accessToken: string,
        _since: Date,
        limit = 50,
    ): Promise<NormalizedWorkout[]> {
        const res = await fetchWithRetry(
            `${WAHOO_API}/workouts?per_page=${limit}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            },
        );

        if (!res.ok) return [];

        const data = (await res.json()) as {
            workouts: Record<string, unknown>[];
        };
        return (data.workouts || [])
            .slice(0, limit)
            .map((w) => this.normalizeActivity(w));
    }

    // ── Mapping ──

    mapActivityType(wahooType: string): ActivityType {
        return WahooProvider.ACTIVITY_MAP[wahooType.toLowerCase()] || "OTHER";
    }

    private normalizeActivity(a: Record<string, unknown>): NormalizedWorkout {
        const summary = (a.workout_summary || a) as Record<string, unknown>;
        const workout = (a.workout || a) as Record<string, unknown>;

        const durationS = Number(summary.duration_active_accum || workout.duration_active_accum || 0);
        const distanceM = Number(summary.distance_accum || workout.distance_accum || 0);
        const sport = String(workout.workout_type || workout.name || "other");

        return {
            activityType: this.mapActivityType(sport),
            source: "WAHOO",
            startedAt: new Date(String(workout.starts || workout.created_at || new Date().toISOString())),
            durationS: durationS || null,
            distanceM: distanceM || null,
            avgHr: (summary.heart_rate_avg as number) || null,
            maxHr: null, // Not always in summary
            avgPaceSKm:
                distanceM > 0
                    ? Math.round(durationS / (distanceM / 1000))
                    : null,
            avgPowerW: (summary.power_avg as number) || null,
            calories: (summary.calories_accum as number) || null,
            tss: null,
            rawData: a,
            notes: (workout.description as string) || null,
        };
    }
}
