import { NextResponse } from "next/server";
import { getRequestPublicOrigin } from "@/lib/public-origin";
import { createClient } from "@/lib/supabase/server";

function normalizeNextPath(next: string | null, webBasePath: string) {
	if (!next?.startsWith("/")) return `${webBasePath}/dashboard`;
	if (next.startsWith(webBasePath)) return next;
	return `${webBasePath}${next}`;
}

export async function GET(request: Request) {
	const webBasePath = "/workout";
	const { searchParams } = new URL(request.url);
	const origin = getRequestPublicOrigin(request);
	const code = searchParams.get("code");
	const next = searchParams.get("next");
	const safeNext = normalizeNextPath(next, webBasePath);

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			return NextResponse.redirect(`${origin}${safeNext}`);
		}
	}

	return NextResponse.redirect(`${origin}${webBasePath}/login?error=auth_failed`);
}
