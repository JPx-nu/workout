function getRequiredEnv(name: string, value: string | undefined): string {
	const trimmed = value?.trim();
	if (!trimmed) {
		throw new Error(`${name} is required for Supabase configuration.`);
	}

	return trimmed;
}

// IMPORTANT:
// Keep these NEXT_PUBLIC_* reads static. In the standalone production build,
// browser bundles only receive public env values that Next can inline at build time.
// Replacing these with dynamic access like process.env[name] can work locally but ship
// an empty runtime env object in production, which breaks Supabase initialization.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function getSupabasePublicConfig() {
	return {
		url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
		publishableKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey),
	};
}
