import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

export async function createClient() {
	const cookieStore = await cookies();
	const { url, publishableKey } = getSupabasePublicConfig();

	return createServerClient(url, publishableKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options);
					}
				} catch {
					// setAll called from Server Component — can be ignored
				}
			},
		},
	});
}
