import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	let response = NextResponse.next({ request });

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					response = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) =>
						response.cookies.set(name, value, options),
					);
				},
			},
		},
	);

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
