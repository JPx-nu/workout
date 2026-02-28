// ============================================================
// Strava Provider
// Implements IntegrationProvider for Strava API v3.
// Docs: https://developers.strava.com/docs/reference/
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

const STRAVA_API = "https://www.strava.com/api/v3";

export class StravaProvider implements IntegrationProvider {
    readonly name = "STRAVA" as const;

    readonly oauthConfig: OAuthConfig = {
        authorizeUrl: "https://www.strava.com/oauth/authorize",
        tokenUrl: "https://www.strava.com/oauth/token",
        revokeUrl: "https://www.strava.com/oauth/deauthorize",
        clientId: INTEGRATION_CONFIG.STRAVA.clientId,
        clientSecret: INTEGRATION_CONFIG.STRAVA.clientSecret,
        scopes: ["read", "activity:read_all"],
        callbackPath: "/api/integrations/strava/callback",
        oauthVersion: "2.0",
    };

    // ── Activity type mapping ──
    private static readonly ACTIVITY_MAP: Record<string, ActivityType> = {
        Run: "RUN",
        VirtualRun: "RUN",
        TrailRun: "RUN",
        Ride: "BIKE",
        VirtualRide: "BIKE",
        GravelRide: "BIKE",
        MountainBikeRide: "BIKE",
        EBikeRide: "BIKE",
        Swim: "SWIM",
        WeightTraining: "STRENGTH",
        Yoga: "YOGA",
    };

    // ── OAuth ──

    buildAuthUrl(state: string): string {
        const params = new URLSearchParams({
            client_id: this.oauthConfig.clientId,
            response_type: "code",
            redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
            approval_prompt: "auto",
            scope: this.oauthConfig.scopes.join(","),
            state,
        });
        return `${this.oauthConfig.authorizeUrl}?${params}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokens> {
        const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: this.oauthConfig.clientId,
                client_secret: this.oauthConfig.clientSecret,
                code,
                grant_type: "authorization_code",
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new ProviderApiError("STRAVA", res.status, `Code exchange failed: ${err}`);
        }

        const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_at: number;
            athlete: { id: number };
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(data.expires_at * 1000),
            providerUserId: String(data.athlete.id),
            scopes: this.oauthConfig.scopes,
        };
    }

    async refreshToken(refreshToken: string): Promise<OAuthTokens> {
        const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                client_id: this.oauthConfig.clientId,
                client_secret: this.oauthConfig.clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            }),
        });

        if (!res.ok) {
            throw new ProviderApiError("STRAVA", res.status, "Token refresh failed");
        }

        const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_at: number;
        };

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: new Date(data.expires_at * 1000),
            providerUserId: "", // Not returned on refresh
            scopes: this.oauthConfig.scopes,
        };
    }

    async revokeAccess(accessToken: string): Promise<void> {
        await fetch(this.oauthConfig.revokeUrl!, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }

    // ── Webhooks ──

    verifyWebhook(
        _headers: Record<string, string>,
        _body: string,
    ): boolean {
        // Strava webhooks don't use HMAC signatures.
        // Verification is done via subscription_id matching during setup.
        return true;
    }

    extractOwnerIdFromWebhook(event: Record<string, unknown>): string {
        return String(event.owner_id);
    }

    extractActivityIdFromWebhook(event: Record<string, unknown>): string {
        return String(event.object_id);
    }

    // ── Data Fetching ──

    async fetchActivity(
        accessToken: string,
        activityId: string,
    ): Promise<NormalizedWorkout> {
        const res = await fetchWithRetry(`${STRAVA_API}/activities/${activityId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) {
            throw new ProviderApiError("STRAVA", res.status, `fetchActivity ${activityId} failed`);
        }

        const a = (await res.json()) as Record<string, unknown>;
        return this.normalizeActivity(a);
    }

    async fetchActivities(
        accessToken: string,
        since: Date,
        limit = 50,
    ): Promise<NormalizedWorkout[]> {
        const after = Math.floor(since.getTime() / 1000);
        const params = new URLSearchParams({
            after: String(after),
            per_page: String(Math.min(limit, 200)),
        });

        const res = await fetchWithRetry(
            `${STRAVA_API}/athlete/activities?${params}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            },
        );

        if (!res.ok) {
            throw new ProviderApiError("STRAVA", res.status, "fetchActivities failed");
        }

        const activities = (await res.json()) as Record<string, unknown>[];
        return activities.map((a) => this.normalizeActivity(a));
    }

    // ── Mapping ──

    mapActivityType(stravaType: string): ActivityType {
        return StravaProvider.ACTIVITY_MAP[stravaType] || "OTHER";
    }

    private normalizeActivity(a: Record<string, unknown>): NormalizedWorkout {
        const type = String(a.type || "Other");
        const elapsedTime = Number(a.elapsed_time || 0);
        const distance = Number(a.distance || 0);

        return {
            activityType: this.mapActivityType(type),
            source: "STRAVA",
            startedAt: new Date(String(a.start_date)),
            durationS: elapsedTime || null,
            distanceM: distance || null,
            avgHr: (a.average_heartrate as number) || null,
            maxHr: (a.max_heartrate as number) || null,
            avgPaceSKm:
                distance > 0
                    ? Math.round(elapsedTime / (distance / 1000))
                    : null,
            avgPowerW: (a.average_watts as number) || null,
            calories: (a.calories as number) || null,
            tss: (a.suffer_score as number) || null,
            rawData: a,
            notes: (a.description as string) || null,
        };
    }
}
