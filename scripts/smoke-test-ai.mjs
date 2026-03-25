const requiredEnv = [
	"NEXT_PUBLIC_SUPABASE_URL",
	"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	"NEXT_PUBLIC_API_URL",
];

for (const name of requiredEnv) {
	if (!process.env[name]?.trim()) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL.trim();
const email = process.env.PLAYWRIGHT_TEST_EMAIL?.trim() || "demo@jpx.nu";
const password = process.env.PLAYWRIGHT_TEST_PASSWORD?.trim() || "demo1234";
const prompt =
	process.env.AI_SMOKE_TEST_PROMPT?.trim() ||
	"What should I focus on in training this week based on my recent workouts?";

async function expectOkJson(response, context) {
	if (response.ok) {
		return response.json();
	}

	const body = await response.text();
	throw new Error(`${context} failed with ${response.status}: ${body}`);
}

async function signIn() {
	const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: {
			apikey: publishableKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ email, password }),
	});

	const data = await expectOkJson(response, "Supabase password sign-in");
	if (typeof data.access_token !== "string" || data.access_token.length === 0) {
		throw new Error("Supabase password sign-in did not return an access token.");
	}

	return data.access_token;
}

async function smokeTestAiStream(accessToken) {
	const response = await fetch(new URL("/api/ai/stream", apiBaseUrl), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messages: [
				{
					id: "smoke-user-message",
					role: "user",
					parts: [{ type: "text", text: prompt }],
				},
			],
		}),
	});

	const body = await response.text();
	if (!response.ok) {
		throw new Error(`Published AI stream failed with ${response.status}: ${body}`);
	}

	if (!body.includes('"type":"message-metadata"')) {
		throw new Error(`Published AI stream did not emit message metadata: ${body}`);
	}

	if (!body.includes('"type":"text-delta"')) {
		throw new Error(`Published AI stream did not emit text content: ${body}`);
	}

	if (!body.includes("[DONE]")) {
		throw new Error(`Published AI stream did not finish cleanly: ${body}`);
	}
}

const accessToken = await signIn();
await smokeTestAiStream(accessToken);

console.log(`AI smoke test passed for ${apiBaseUrl}`);
