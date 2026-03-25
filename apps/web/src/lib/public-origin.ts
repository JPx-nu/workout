const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function normalizeHostname(hostname: string): string {
	return hostname
		.trim()
		.replace(/^\[(.*)\]$/, "$1")
		.toLowerCase();
}

function getHostHostname(host: string): string | null {
	try {
		return new URL(`http://${host}`).hostname;
	} catch {
		return null;
	}
}

export function isLocalHostname(hostname: string): boolean {
	return LOCAL_HOSTNAMES.has(normalizeHostname(hostname));
}

function toOrigin(value: string | null | undefined): string | null {
	if (!value) return null;

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function getConfiguredPublicOrigin(): string | null {
	return toOrigin(process.env.NEXT_PUBLIC_WEB_URL);
}

export function getBrowserPublicOrigin(windowLocation: Location): string {
	if (isLocalHostname(windowLocation.hostname)) {
		return windowLocation.origin;
	}

	return getConfiguredPublicOrigin() ?? windowLocation.origin;
}

export function getRequestPublicOrigin(request: Request): string {
	const requestUrl = new URL(request.url);
	const forwardedHost = request.headers.get("x-forwarded-host");
	const host = request.headers.get("host");
	const forwardedProto =
		request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

	for (const candidate of [forwardedHost, host]) {
		if (!candidate) continue;

		const hostname = getHostHostname(candidate);
		if (!hostname || isLocalHostname(hostname)) continue;

		return `${forwardedProto}://${candidate}`;
	}

	return getConfiguredPublicOrigin() ?? requestUrl.origin;
}
