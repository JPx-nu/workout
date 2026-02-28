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

    STRAVA: {
        clientId: env("STRAVA_CLIENT_ID"),
        clientSecret: env("STRAVA_CLIENT_SECRET"),
        verifyToken: env("STRAVA_VERIFY_TOKEN", "jpx-triathlon-strava"),
    },

    GARMIN: {
        consumerKey: env("GARMIN_CONSUMER_KEY"),
        consumerSecret: env("GARMIN_CONSUMER_SECRET"),
    },

    POLAR: {
        clientId: env("POLAR_CLIENT_ID"),
        clientSecret: env("POLAR_CLIENT_SECRET"),
    },

    WAHOO: {
        clientId: env("WAHOO_CLIENT_ID"),
        clientSecret: env("WAHOO_CLIENT_SECRET"),
    },
} as const;
