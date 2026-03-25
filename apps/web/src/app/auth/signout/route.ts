import { NextResponse } from "next/server";
import { getRequestPublicOrigin } from "@/lib/public-origin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
	const supabase = await createClient();
	await supabase.auth.signOut();

	const origin = getRequestPublicOrigin(request);
	return NextResponse.redirect(new URL("/workout/login", origin), {
		status: 302,
	});
}
