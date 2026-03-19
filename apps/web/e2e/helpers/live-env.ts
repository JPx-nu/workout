import fs from "node:fs";
import path from "node:path";

const DEFAULT_LOCAL_BASE_URL = "http://localhost:3100/workout/";

const ENV_FILE_PATHS = [
	path.resolve(__dirname, "..", "..", ".env.local"),
	path.resolve(__dirname, "..", "..", ".env"),
	path.resolve(__dirname, "..", "..", "..", ".env.local"),
	path.resolve(__dirname, "..", "..", "..", ".env"),
];

let cachedEnvValues: Map<string, string> | null = null;

function parseEnvFile(filePath: string): Map<string, string> {
	const values = new Map<string, string>();

	if (!fs.existsSync(filePath)) {
		return values;
	}

	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		const value = trimmed
			.slice(separatorIndex + 1)
			.trim()
			.replace(/^['"]|['"]$/g, "");
		if (key && value) {
			values.set(key, value);
		}
	}

	return values;
}

function getLoadedEnvValues(): Map<string, string> {
	if (cachedEnvValues) {
		return cachedEnvValues;
	}

	cachedEnvValues = new Map<string, string>();
	for (const filePath of ENV_FILE_PATHS) {
		for (const [key, value] of parseEnvFile(filePath)) {
			if (!cachedEnvValues.has(key)) {
				cachedEnvValues.set(key, value);
			}
		}
	}

	return cachedEnvValues;
}

function getOptionalEnv(name: string): string | undefined {
	const value = process.env[name]?.trim() ?? getLoadedEnvValues().get(name);
	return value ? value : undefined;
}

export function getPlaywrightBaseUrl(): string {
	const baseUrl = getOptionalEnv("PLAYWRIGHT_BASE_URL") ?? DEFAULT_LOCAL_BASE_URL;
	return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function getPlaywrightCredentials(): {
	kind: "credentials";
	email: string;
	password: string;
} {
	const email = getOptionalEnv("PLAYWRIGHT_TEST_EMAIL");
	const password = getOptionalEnv("PLAYWRIGHT_TEST_PASSWORD");

	if (!email && !password) {
		return {
			kind: "credentials",
			email: "demo@jpx.nu",
			password: "demo1234",
		};
	}

	if (!email || !password) {
		throw new Error(
			"Set both PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD, or leave both unset to use the live demo athlete credentials.",
		);
	}

	return {
		kind: "credentials",
		email,
		password,
	};
}

export function getSupabasePublicConfig(): { url: string; publishableKey: string } {
	const url = getOptionalEnv("NEXT_PUBLIC_SUPABASE_URL");
	const publishableKey = getOptionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

	if (!url || !publishableKey) {
		throw new Error(
			"Playwright requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local, the repo root env file, or the current shell.",
		);
	}

	return {
		url,
		publishableKey,
	};
}

export function createUniqueLabel(prefix: string): string {
	// These tests write to live data, so labels must avoid colliding with prior runs.
	return `${prefix}-${Date.now()}`;
}
