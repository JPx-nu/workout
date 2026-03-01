// ============================================================
// Garmin Provider
// Implements IntegrationProvider for Garmin Health API.
// Note: Garmin uses OAuth 1.0a and requires business approval.
// Docs: https://developer.garmin.com/gc-developer-program/
// ============================================================

import { INTEGRATION_CONFIG } from "../../../config/integrations.js";
import { createLogger } from "../../../lib/logger.js";
import { ProviderApiError, ProviderUnavailableError } from "../errors.js";
import { fetchWithRetry } from "../http.js";
import type {
	ActivityType,
	IntegrationProvider,
	NormalizedMetric,
	NormalizedWorkout,
	OAuthConfig,
	OAuthTokens,
} from "../types.js";

const log = createLogger({ module: "garmin-provider" });

export class GarminProvider implements IntegrationProvider {
	readonly name = "GARMIN" as const;

	readonly oauthConfig: OAuthConfig = {
		// Garmin uses OAuth 1.0a — these URLs are placeholders
		// until business API access is approved
		authorizeUrl: "https://connect.garmin.com/oauthConfirm",
		tokenUrl: "https://connectapi.garmin.com/oauth-service/oauth/access_token",
		revokeUrl: undefined,
		clientId: INTEGRATION_CONFIG.GARMIN.consumerKey,
		clientSecret: INTEGRATION_CONFIG.GARMIN.consumerSecret,
		scopes: [],
		callbackPath: "/api/integrations/garmin/callback",
		oauthVersion: "1.0a",
	};

	// ── Activity type mapping ──
	private static readonly ACTIVITY_MAP: Record<string, ActivityType> = {
		running: "RUN",
		trail_running: "RUN",
		treadmill_running: "RUN",
		cycling: "BIKE",
		mountain_biking: "BIKE",
		indoor_cycling: "BIKE",
		virtual_ride: "BIKE",
		lap_swimming: "SWIM",
		open_water_swimming: "SWIM",
		strength_training: "STRENGTH",
		yoga: "YOGA",
		multi_sport: "OTHER", // Triathlon — could be split
	};

	// ── OAuth (stub — requires OAuth 1.0a implementation) ──

	buildAuthUrl(_state: string): string {
		// TODO: Implement OAuth 1.0a request token flow
		// Garmin requires: request token → user authorize → access token
		log.warn("OAuth 1.0a not yet implemented — requires business API approval");
		const params = new URLSearchParams({
			oauth_callback: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
		});
		return `${this.oauthConfig.authorizeUrl}?${params}`;
	}

	async exchangeCode(_code: string): Promise<OAuthTokens> {
		// TODO: Implement OAuth 1.0a token exchange (uses oauth_verifier, not code)
		throw new ProviderUnavailableError(
			"GARMIN",
			"OAuth 1.0a token exchange not yet implemented — awaiting API approval",
		);
	}

	async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
		// Garmin OAuth 1.0a tokens don't expire — no refresh needed
		throw new Error("[Garmin] OAuth 1.0a tokens do not expire");
	}

	async revokeAccess(_accessToken: string): Promise<void> {
		// TODO: Call Garmin deregistration endpoint
		log.warn("Access revocation not yet implemented");
	}

	// ── Webhooks ──

	verifyWebhook(_headers: Record<string, string>, _body: string): boolean {
		// Garmin webhook signature verification requires business API approval.
		// Once granted, verify using consumer secret + OAuth 1.0a signature.
		log.warn("Garmin webhook signature verification not yet implemented — accepting all");
		return true;
	}

	extractOwnerIdFromWebhook(event: Record<string, unknown>): string {
		// Garmin uses userAccessToken or userId in webhook payloads
		return String(event.userId || event.userAccessToken || "");
	}

	extractActivityIdFromWebhook(event: Record<string, unknown>): string {
		return String(event.activityId || event.summaryId || "");
	}

	// ── Data Fetching ──

	async fetchActivity(accessToken: string, activityId: string): Promise<NormalizedWorkout> {
		// Garmin pushes data via webhooks — this fetches on demand
		const res = await fetchWithRetry(
			`https://apis.garmin.com/wellness-api/rest/activities/${activityId}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (!res.ok) {
			throw new ProviderApiError("GARMIN", res.status, `fetchActivity failed`);
		}

		const a = (await res.json()) as Record<string, unknown>;
		return this.normalizeActivity(a);
	}

	async fetchActivities(
		accessToken: string,
		since: Date,
		limit = 50,
	): Promise<NormalizedWorkout[]> {
		const params = new URLSearchParams({
			uploadStartTimeInSeconds: String(Math.floor(since.getTime() / 1000)),
			uploadEndTimeInSeconds: String(Math.floor(Date.now() / 1000)),
		});

		const res = await fetchWithRetry(
			`https://apis.garmin.com/wellness-api/rest/activities?${params}`,
			{
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		if (!res.ok) {
			throw new ProviderApiError("GARMIN", res.status, "fetchActivities failed");
		}

		const activities = (await res.json()) as Record<string, unknown>[];
		return activities.slice(0, limit).map((a) => this.normalizeActivity(a));
	}

	async fetchHealthData(accessToken: string, date: Date): Promise<NormalizedMetric[]> {
		const dateStr = date.toISOString().split("T")[0];
		const metrics: NormalizedMetric[] = [];

		try {
			// Fetch daily summary
			const res = await fetchWithRetry(
				`https://apis.garmin.com/wellness-api/rest/dailies?calendarDate=${dateStr}`,
				{ headers: { Authorization: `Bearer ${accessToken}` } },
			);

			if (res.ok) {
				const summaries = (await res.json()) as Record<string, unknown>[];
				for (const s of summaries) {
					if (s.restingHeartRateInBeatsPerMinute) {
						metrics.push({
							metricType: "RESTING_HR",
							value: Number(s.restingHeartRateInBeatsPerMinute),
							unit: "bpm",
							recordedAt: new Date(dateStr),
							source: "GARMIN",
							rawData: s,
						});
					}
					if (s.steps) {
						metrics.push({
							metricType: "STEPS",
							value: Number(s.steps),
							unit: "count",
							recordedAt: new Date(dateStr),
							source: "GARMIN",
							rawData: s,
						});
					}
					if (s.activeKilocalories) {
						metrics.push({
							metricType: "ACTIVE_CALORIES",
							value: Number(s.activeKilocalories),
							unit: "kcal",
							recordedAt: new Date(dateStr),
							source: "GARMIN",
							rawData: s,
						});
					}
				}
			}
		} catch (err) {
			log.error({ err }, "fetchHealthData error");
		}

		return metrics;
	}

	// ── Mapping ──

	mapActivityType(garminType: string): ActivityType {
		return GarminProvider.ACTIVITY_MAP[garminType.toLowerCase()] || "OTHER";
	}

	private normalizeActivity(a: Record<string, unknown>): NormalizedWorkout {
		const activityType = String(a.activityType || a.sportType || "other");
		const durationS = Number(a.durationInSeconds || a.elapsedDurationInSeconds || 0);
		const distanceM = Number(a.distanceInMeters || 0);

		return {
			activityType: this.mapActivityType(activityType),
			source: "GARMIN",
			startedAt: new Date(Number(a.startTimeInSeconds || 0) * 1000),
			durationS: durationS || null,
			distanceM: distanceM || null,
			avgHr: (a.averageHeartRateInBeatsPerMinute as number) || null,
			maxHr: (a.maxHeartRateInBeatsPerMinute as number) || null,
			avgPaceSKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : null,
			avgPowerW: (a.averagePowerInWatts as number) || null,
			calories: (a.activeKilocalories as number) || null,
			tss: null, // Garmin uses Training Effect, not TSS
			rawData: a,
			notes: null,
		};
	}
}
