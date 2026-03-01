// ============================================================
// Fitness Integration Library — Core Types
// Provider-agnostic interfaces for OAuth, webhooks, and data
// normalization. Any new provider implements IntegrationProvider.
//
// Architecture note: continuously evaluate emerging fitness APIs
// (e.g. Coros, Whoop, Oura) and aggregators (Terra, ROOK) for
// future expansion. Adding a new provider should take ~2h by
// implementing this interface + registering in the registry.
// ============================================================

// ── Provider source IDs (must match workouts.source CHECK) ──

export type ProviderName = "STRAVA" | "GARMIN" | "POLAR" | "WAHOO" | "SUUNTO";

// ── OAuth Configuration ──

export interface OAuthConfig {
	/** Authorization URL (user-facing redirect) */
	authorizeUrl: string;
	/** Token exchange URL */
	tokenUrl: string;
	/** Token revocation URL (optional) */
	revokeUrl?: string;
	/** Application client ID */
	clientId: string;
	/** Application client secret */
	clientSecret: string;
	/** Requested scopes */
	scopes: string[];
	/** OAuth callback path on our API (e.g. /api/integrations/strava/callback) */
	callbackPath: string;
	/** OAuth version — defaults to 2.0, Garmin uses 1.0a */
	oauthVersion?: "1.0a" | "2.0";
}

// ── OAuth Tokens ──

export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
	/** External user ID on the provider platform */
	providerUserId: string;
	scopes: string[];
}

// ── Connected Account (DB row) ──

export interface ConnectedAccount {
	id: string;
	athlete_id: string;
	provider: ProviderName;
	access_token: string;
	refresh_token: string | null;
	token_expires: string | null;
	provider_uid: string | null;
	scopes: string[] | null;
	last_sync_at: string | null;
	created_at: string;
}

// ── Normalized Workout (provider-agnostic output) ──

export type ActivityType = "SWIM" | "BIKE" | "RUN" | "STRENGTH" | "YOGA" | "OTHER";

export interface NormalizedWorkout {
	activityType: ActivityType;
	source: ProviderName;
	startedAt: Date;
	durationS: number | null;
	distanceM: number | null;
	avgHr: number | null;
	maxHr: number | null;
	avgPaceSKm: number | null;
	avgPowerW: number | null;
	calories: number | null;
	tss: number | null;
	/** Full original payload — stored for future data mining */
	rawData: Record<string, unknown>;
	notes: string | null;
}

// ── Normalized Health Metric ──

export type MetricType =
	| "SLEEP_HOURS"
	| "SLEEP_STAGES"
	| "HRV"
	| "RESTING_HR"
	| "STEPS"
	| "ACTIVE_CALORIES"
	| "SPO2"
	| "VO2MAX";

export interface NormalizedMetric {
	metricType: MetricType;
	value: number;
	unit: string;
	recordedAt: Date;
	source: ProviderName;
	rawData?: Record<string, unknown>;
}

// ── The Provider Interface ──
// Every fitness platform implements this contract.
// The normalizer, OAuth factory, and webhook handler work
// against this interface — never against provider-specific code.

export interface IntegrationProvider {
	/** Provider identifier (matches DB enum) */
	readonly name: ProviderName;

	/** OAuth configuration for this provider */
	readonly oauthConfig: OAuthConfig;

	// ── OAuth lifecycle ──

	/** Build the URL to redirect the user to for authorization */
	buildAuthUrl(state: string): string;

	/** Exchange authorization code for access + refresh tokens */
	exchangeCode(code: string): Promise<OAuthTokens>;

	/** Refresh an expired access token */
	refreshToken(refreshToken: string): Promise<OAuthTokens>;

	/** Revoke access (disconnect) */
	revokeAccess(accessToken: string): Promise<void>;

	// ── Webhook handling ──

	/** Verify webhook signature/authenticity. Returns true if valid. */
	verifyWebhook(headers: Record<string, string>, body: string): boolean | Promise<boolean>;

	/** Extract the provider's user ID from a webhook event payload */
	extractOwnerIdFromWebhook(event: Record<string, unknown>): string;

	/** Extract the activity/object ID from a webhook event payload */
	extractActivityIdFromWebhook(event: Record<string, unknown>): string;

	// ── Data fetching ──

	/** Fetch a single activity by its provider-specific ID */
	fetchActivity(accessToken: string, activityId: string): Promise<NormalizedWorkout>;

	/** Fetch recent activities since a given date (for initial backfill) */
	fetchActivities(accessToken: string, since: Date, limit?: number): Promise<NormalizedWorkout[]>;

	/**
	 * Fetch biometric/health data for a given day.
	 * Optional — Strava and Wahoo don't provide this.
	 * Garmin and Polar push HRV, sleep, resting HR.
	 */
	fetchHealthData?(accessToken: string, date: Date): Promise<NormalizedMetric[]>;

	// ── Data mapping ──

	/** Map provider-specific activity type string to our enum */
	mapActivityType(providerType: string): ActivityType;
}

// ── Webhook Event Types ──

export interface WebhookEvent {
	provider: ProviderName;
	eventType: "activity.create" | "activity.update" | "activity.delete" | "athlete.deauthorize";
	objectId: string;
	ownerId: string;
	rawEvent: Record<string, unknown>;
}

// ── Sync Result ──

export interface SyncResult {
	workoutsInserted: number;
	workoutsSkipped: number;
	metricsInserted: number;
	metricsSkipped: number;
}
