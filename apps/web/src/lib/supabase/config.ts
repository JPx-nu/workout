function getRequiredEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required for Supabase configuration.`);
	}

	return value;
}

export function getSupabasePublicConfig() {
	return {
		url: getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
		publishableKey: getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
	};
}
