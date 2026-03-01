// ============================================================
// Polar Provider
// Implements IntegrationProvider for Polar AccessLink API.
// Docs: https://www.polar.com/accesslink-api/
// Note: Polar uses a transactional model — webhook notifies
// data is ready, then you pull + commit.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { INTEGRATION_CONFIG } from "../../../config/integrations.js";
import { createLogger } from "../../../lib/logger.js";
import { ProviderApiError } from "../errors.js";
import { fetchWithRetry } from "../http.js";
import type {
	ActivityType,
	IntegrationProvider,
	NormalizedMetric,
	NormalizedWorkout,
	OAuthConfig,
	OAuthTokens,
} from "../types.js";

const log = createLogger({ module: "polar-provider" });

const POLAR_API = "https://www.polaraccesslink.com/v3";

export class PolarProvider implements IntegrationProvider {
	readonly name = "POLAR" as const;

	readonly oauthConfig: OAuthConfig = {
		authorizeUrl: "https://flow.polar.com/oauth2/authorization",
		tokenUrl: "https://polarremote.com/v2/oauth2/token",
		revokeUrl: undefined,
		clientId: INTEGRATION_CONFIG.POLAR.clientId,
		clientSecret: INTEGRATION_CONFIG.POLAR.clientSecret,
		scopes: ["accesslink.read_all"],
		callbackPath: "/api/integrations/polar/callback",
		oauthVersion: "2.0",
	};

	private static readonly ACTIVITY_MAP: Record<string, ActivityType> = {
		RUNNING: "RUN",
		JOGGING: "RUN",
		ROAD_RUNNING: "RUN",
		TRAIL_RUNNING: "RUN",
		TREADMILL_RUNNING: "RUN",
		CYCLING: "BIKE",
		ROAD_BIKING: "BIKE",
		MOUNTAIN_BIKING: "BIKE",
		INDOOR_CYCLING: "BIKE",
		SWIMMING: "SWIM",
		POOL_SWIMMING: "SWIM",
		OPEN_WATER_SWIMMING: "SWIM",
		STRENGTH_TRAINING: "STRENGTH",
		YOGA: "YOGA",
		TRIATHLON: "OTHER", // Multi-sport
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
		const credentials = Buffer.from(
			`${this.oauthConfig.clientId}:${this.oauthConfig.clientSecret}`,
		).toString("base64");

		const res = await fetchWithRetry(this.oauthConfig.tokenUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
				Accept: "application/json",
			},
			body: new URLSearchParams({
				grant_type: "authorization_code",
				code,
				redirect_uri: `${INTEGRATION_CONFIG.apiBaseUrl}${this.oauthConfig.callbackPath}`,
			}),
		});

		if (!res.ok) {
			throw new ProviderApiError("POLAR", res.status, "Code exchange failed");
		}

		const data = (await res.json()) as {
			access_token: string;
			token_type: string;
			x_user_id: number;
		};

		// Polar tokens don't expire (no refresh token)
		return {
			accessToken: data.access_token,
			refreshToken: "", // Polar doesn't use refresh tokens
			expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Far future
			providerUserId: String(data.x_user_id),
			scopes: this.oauthConfig.scopes,
		};
	}

	async refreshToken(_refreshToken: string): Promise<OAuthTokens> {
		// Polar tokens don't expire
		throw new Error("[Polar] Tokens do not expire — no refresh needed");
	}

	async revokeAccess(accessToken: string): Promise<void> {
		// Delete user registration from AccessLink
		await fetch(`${POLAR_API}/users/current`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${accessToken}` },
		});
	}

	// ── Webhooks ──

	verifyWebhook(headers: Record<string, string>, body: string): boolean {
		const secret = INTEGRATION_CONFIG.POLAR.webhookSecret;
		if (!secret) {
			log.warn("POLAR_WEBHOOK_SECRET not configured — skipping signature verification");
			return true;
		}

		const signature = headers["polar-webhook-signature"] || headers["Polar-Webhook-Signature"];
		if (!signature) {
			log.warn("Missing Polar-Webhook-Signature header");
			return false;
		}

		const expected = createHmac("sha256", secret).update(body).digest("hex");
		try {
			return timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
		} catch {
			return false;
		}
	}

	extractOwnerIdFromWebhook(event: Record<string, unknown>): string {
		return String(event.user_id || "");
	}

	extractActivityIdFromWebhook(event: Record<string, unknown>): string {
		return String(event.entity_id || event.exercise_id || "");
	}

	// ── Data Fetching ──

	async fetchActivity(accessToken: string, activityId: string): Promise<NormalizedWorkout> {
		const res = await fetchWithRetry(`${POLAR_API}/exercises/${activityId}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		});

		if (!res.ok) {
			throw new ProviderApiError("POLAR", res.status, "fetchActivity failed");
		}

		const a = (await res.json()) as Record<string, unknown>;
		return this.normalizeActivity(a);
	}

	async fetchActivities(
		accessToken: string,
		_since: Date,
		limit = 50,
	): Promise<NormalizedWorkout[]> {
		// Polar uses transactional pull — create transaction, list, commit
		const txRes = await fetchWithRetry(`${POLAR_API}/exercises`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		});

		if (!txRes.ok) return [];

		const exercises = (await txRes.json()) as Record<string, unknown>[];
		return exercises.slice(0, limit).map((a) => this.normalizeActivity(a));
	}

	async fetchHealthData(accessToken: string, _date: Date): Promise<NormalizedMetric[]> {
		const metrics: NormalizedMetric[] = [];

		try {
			// Fetch sleep data (Nightly Recharge)
			const sleepRes = await fetchWithRetry(`${POLAR_API}/users/sleep`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Accept: "application/json",
				},
			});

			if (sleepRes.ok) {
				const sleepData = (await sleepRes.json()) as Record<string, unknown>;
				if (sleepData.sleep_duration) {
					metrics.push({
						metricType: "SLEEP_HOURS",
						value: Number(sleepData.sleep_duration) / 3600, // seconds → hours
						unit: "hours",
						recordedAt: new Date(),
						source: "POLAR",
						rawData: sleepData,
					});
				}
			}
		} catch (err) {
			log.error({ err }, "fetchHealthData error");
		}

		return metrics;
	}

	// ── Mapping ──

	mapActivityType(polarType: string): ActivityType {
		return PolarProvider.ACTIVITY_MAP[polarType.toUpperCase()] || "OTHER";
	}

	private normalizeActivity(a: Record<string, unknown>): NormalizedWorkout {
		const sport = String(a.sport || a.detailed_sport_info || "OTHER");
		const durationStr = String(a.duration || "PT0S");
		const durationS = this.parseDuration(durationStr);
		const distanceM = Number(a.distance || 0);

		return {
			activityType: this.mapActivityType(sport),
			source: "POLAR",
			startedAt: new Date(String(a.start_time || new Date().toISOString())),
			durationS: durationS || null,
			distanceM: distanceM || null,
			avgHr: (a.heart_rate as { average?: number })?.average || null,
			maxHr: (a.heart_rate as { maximum?: number })?.maximum || null,
			avgPaceSKm: distanceM > 0 ? Math.round(durationS / (distanceM / 1000)) : null,
			avgPowerW: null, // Available in detailed data
			calories: (a.calories as number) || null,
			tss: (a.training_load as number) || null,
			rawData: a,
			notes: null,
		};
	}

	/** Parse ISO 8601 duration (PT1H30M45S) to seconds */
	private parseDuration(iso: string): number {
		const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
		if (!match) return 0;
		const h = parseInt(match[1] || "0", 10);
		const m = parseInt(match[2] || "0", 10);
		const s = parseFloat(match[3] || "0");
		return h * 3600 + m * 60 + Math.round(s);
	}
}
