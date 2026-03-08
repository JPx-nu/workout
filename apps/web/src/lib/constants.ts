const DEFAULT_LOCAL_API_URL = "http://localhost:8787";

function isLocalHostname(hostname: string): boolean {
	return hostname === "localhost" || hostname === "127.0.0.1";
}

/** API base URL for browser-side calls to the Hono API server. */
export function getApiBaseUrl(): string {
	const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
	return configured && configured.length > 0 ? configured : DEFAULT_LOCAL_API_URL;
}

export function getApiUrl(path: string): string {
	return new URL(path, getApiBaseUrl()).toString();
}

export function getApiConfigurationError(): string | null {
	const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
	if (configured && configured.length > 0) {
		return null;
	}

	if (typeof window !== "undefined" && !isLocalHostname(window.location.hostname)) {
		return "This deployment is missing NEXT_PUBLIC_API_URL, so API requests are falling back to localhost.";
	}

	return null;
}
