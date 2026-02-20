import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	console.error("Missing URL or ANON_KEY");
	process.exit(1);
}

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
	console.log("Registering tester@jpx.com...");
	const { data, error } = await client.auth.signUp({
		email: "tester@jpx.com",
		password: "password123",
	});

	if (error) {
		console.error("Failed to sign up:", error);
		process.exit(1);
	}

	console.log("Signup successful:", data.user?.id);
	process.exit(0);
}

run();
