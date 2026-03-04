import { createLogger } from "../lib/logger.js";

const log = createLogger({ module: "startup-env" });

type AppEnv = "local" | "demo" | "prod";

const REQUIRED_ENV_KEYS = [
	"SUPABASE_URL",
	"SUPABASE_ANON_KEY",
	"SUPABASE_SERVICE_ROLE_KEY",
	"SUPABASE_JWT_SECRET",
	"WEB_URL",
	"API_URL",
] as const;

const AI_ENV_KEYS = [
	"AZURE_OPENAI_API_KEY",
	"AZURE_OPENAI_DEPLOYMENT",
	"AZURE_OPENAI_API_VERSION",
] as const;

const INTEGRATION_REQUIRED_KEYS = ["INTEGRATION_ENCRYPTION_KEY"] as const;

const INTEGRATION_PROVIDER_KEYS = [
	"STRAVA_CLIENT_ID",
	"STRAVA_CLIENT_SECRET",
	"STRAVA_VERIFY_TOKEN",
	"POLAR_CLIENT_ID",
	"POLAR_CLIENT_SECRET",
	"POLAR_WEBHOOK_SECRET",
	"WAHOO_CLIENT_ID",
	"WAHOO_CLIENT_SECRET",
	"WAHOO_WEBHOOK_TOKEN",
	"GARMIN_CONSUMER_KEY",
	"GARMIN_CONSUMER_SECRET",
] as const;

function getMissing(keys: readonly string[]): string[] {
	return keys.filter((key) => {
		const value = process.env[key];
		return !value || value.trim().length === 0;
	});
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
	const raw = process.env[name];
	if (!raw || raw.trim().length === 0) return fallback;
	switch (raw.trim().toLowerCase()) {
		case "1":
		case "true":
		case "yes":
		case "on":
			return true;
		case "0":
		case "false":
		case "no":
		case "off":
			return false;
		default:
			log.warn({ env: name, value: raw }, "Invalid boolean environment value; using fallback");
			return fallback;
	}
}

function resolveAppEnv(): AppEnv {
	const explicit = process.env.APP_ENV?.trim().toLowerCase();
	if (explicit === "local" || explicit === "demo" || explicit === "prod") {
		return explicit;
	}
	const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
	if (nodeEnv === "production") return "prod";
	return "local";
}

function validateUrlEnv(
	key: string,
	options: { required: boolean; httpsRequired: boolean },
): string | undefined {
	const raw = process.env[key];
	if (!raw || raw.trim().length === 0) {
		if (options.required) {
			throw new Error(`Missing required URL environment variable: ${key}`);
		}
		return undefined;
	}

	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		throw new Error(`Invalid URL format for ${key}: ${raw}`);
	}

	if (!["http:", "https:"].includes(parsed.protocol)) {
		throw new Error(`Unsupported URL scheme for ${key}: ${parsed.protocol}`);
	}

	if (options.httpsRequired && parsed.protocol !== "https:") {
		throw new Error(`${key} must use https in demo/prod environments`);
	}

	return parsed.toString();
}

export function validateStartupEnv(): void {
	const appEnv = resolveAppEnv();
	const strictMode = appEnv === "demo" || appEnv === "prod";

	const featureFlags = {
		ai: parseBooleanEnv("FEATURE_AI_ENABLED", true),
		integrations: parseBooleanEnv("FEATURE_INTEGRATIONS_ENABLED", true),
		mcp: parseBooleanEnv("FEATURE_MCP_ENABLED", true),
	};

	const missingRequired = getMissing(REQUIRED_ENV_KEYS);
	if (missingRequired.length > 0) {
		const message = `Missing required environment variables: ${missingRequired.join(", ")}`;
		log.error({ missing: missingRequired, appEnv }, message);
		throw new Error(message);
	}

	validateUrlEnv("WEB_URL", { required: true, httpsRequired: strictMode });
	validateUrlEnv("API_URL", { required: true, httpsRequired: strictMode });

	const missingAi = getMissing(AI_ENV_KEYS);
	const hasAzureLocator =
		(process.env.AZURE_OPENAI_INSTANCE_NAME ?? "").trim().length > 0 ||
		(process.env.AZURE_OPENAI_ENDPOINT ?? "").trim().length > 0;

	if (featureFlags.ai) {
		const missing = [
			...(!hasAzureLocator ? ["AZURE_OPENAI_INSTANCE_NAME|AZURE_OPENAI_ENDPOINT"] : []),
			...missingAi,
		];
		if (missing.length > 0) {
			const message = `AI feature enabled but configuration is incomplete: ${missing.join(", ")}`;
			if (strictMode) {
				log.error({ missing, appEnv }, message);
				throw new Error(message);
			}
			log.warn({ missing, appEnv }, `${message}; AI endpoints may return missing_config`);
		}
	}

	if (featureFlags.integrations) {
		const missingCore = getMissing(INTEGRATION_REQUIRED_KEYS);
		const missingProviders = getMissing(INTEGRATION_PROVIDER_KEYS);

		if (missingCore.length > 0) {
			const message = `Integrations enabled but missing required keys: ${missingCore.join(", ")}`;
			if (strictMode) {
				log.error({ missing: missingCore, appEnv }, message);
				throw new Error(message);
			}
			log.warn({ missing: missingCore, appEnv }, message);
		}

		if (missingProviders.length > 0) {
			log.warn(
				{ missing: missingProviders, appEnv },
				"Some provider keys are missing; related provider routes may be unavailable",
			);
		}
	}

	log.info(
		{
			appEnv,
			strictMode,
			featureFlags,
			requiredValidated: REQUIRED_ENV_KEYS.length,
		},
		"Startup environment validation completed",
	);
}
