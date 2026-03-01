import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getCanonicalOrigin(requestOrigin: string) {
	if (process.env.NODE_ENV !== "production") return requestOrigin;

	const configuredWebUrl = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_WEB_URL;
	if (!configuredWebUrl) return requestOrigin;

	let requestHost = "";
	try {
		requestHost = new URL(requestOrigin).hostname;
	} catch {
		return requestOrigin;
	}

	const isLocalOrigin =
		requestHost === "0.0.0.0" || requestHost === "127.0.0.1" || requestHost === "localhost";
	if (!isLocalOrigin) return requestOrigin;

	try {
		return new URL(configuredWebUrl).origin;
	} catch {
		return requestOrigin;
	}
}

function normalizeNextPath(next: string | null, webBasePath: string) {
	if (!next?.startsWith("/")) return `${webBasePath}/dashboard`;
	if (next.startsWith(webBasePath)) return next;
	return `${webBasePath}${next}`;
}

export async function GET(request: Request) {
	const webBasePath = "/workout";
	const { searchParams, origin } = new URL(request.url);
	const canonicalOrigin = getCanonicalOrigin(origin);
	const code = searchParams.get("code");
	const next = searchParams.get("next");
	const safeNext = normalizeNextPath(next, webBasePath);

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			return NextResponse.redirect(`${canonicalOrigin}${safeNext}`);
		}
	}

	return NextResponse.redirect(`${canonicalOrigin}${webBasePath}/login?error=auth_failed`);
}
