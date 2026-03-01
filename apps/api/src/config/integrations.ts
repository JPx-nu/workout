// ============================================================
// Integration Configuration
// Centralised env-var access for all fitness platform providers.
// Add new providers here as the integration library expands.
// ============================================================

function env(key: string, fallback = ""): string {
	return process.env[key] || fallback;
}

export const INTEGRATION_CONFIG = {
	/** Base URL for this API (used to build OAuth callback URLs) */
	apiBaseUrl: env("API_URL", "http://localhost:8787"),

	/** Base URL for the web frontend (used for OAuth redirects) */
	webUrl: env("WEB_URL", "http://localhost:3000"),

	/** Minimum interval between manual sync requests per athlete (ms) */
	syncCooldownMs: 5 * 60 * 1000,

	STRAVA: {
		clientId: env("STRAVA_CLIENT_ID"),
		clientSecret: env("STRAVA_CLIENT_SECRET"),
		verifyToken: env("STRAVA_VERIFY_TOKEN"),
	},

	GARMIN: {
		consumerKey: env("GARMIN_CONSUMER_KEY"),
		consumerSecret: env("GARMIN_CONSUMER_SECRET"),
	},

	POLAR: {
		clientId: env("POLAR_CLIENT_ID"),
		clientSecret: env("POLAR_CLIENT_SECRET"),
		webhookSecret: env("POLAR_WEBHOOK_SECRET"),
	},

	WAHOO: {
		clientId: env("WAHOO_CLIENT_ID"),
		clientSecret: env("WAHOO_CLIENT_SECRET"),
		webhookToken: env("WAHOO_WEBHOOK_TOKEN"),
	},
} as const;
