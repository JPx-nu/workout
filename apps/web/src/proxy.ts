import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
	let response = NextResponse.next({ request });
	const { url, publishableKey } = getSupabasePublicConfig();

	const supabase = createServerClient(url, publishableKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet) {
				for (const { name, value } of cookiesToSet) {
					request.cookies.set(name, value);
				}
				response = NextResponse.next({ request });
				for (const { name, value, options } of cookiesToSet) {
					response.cookies.set(name, value, options);
				}
			},
		},
	});

	// Refresh session
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Auth guard: redirect unauthenticated users away from dashboard
	const pathname = request.nextUrl.pathname;
	if (!user && pathname.startsWith("/dashboard")) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		return NextResponse.redirect(loginUrl);
	}

	// Redirect authenticated users away from login
	if (user && pathname === "/login") {
		const dashUrl = request.nextUrl.clone();
		dashUrl.pathname = "/dashboard";
		return NextResponse.redirect(dashUrl);
	}

	return response;
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
	],
};
