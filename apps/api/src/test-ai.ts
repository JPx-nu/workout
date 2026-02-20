import { HumanMessage } from "@langchain/core/messages";
import { createClient } from "@supabase/supabase-js";
import { AI_CONFIG } from "./config/ai.js";
import { createAgent } from "./services/ai/graph.js";

async function runTest() {
	console.log("🧪 Starting AI Functional Tests...\n");

	// 1. Initialize admin client to bypass RLS for testing
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseKey) {
		console.error(
			"❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.",
		);
		process.exit(1);
	}

	const client = createClient(supabaseUrl, supabaseKey);

	// 2. Fetch or Create a valid athlete profile to test with
	console.log("Logging in as test user...");

	const { data: authData, error: authErr } =
		await client.auth.signInWithPassword({
			email: "tester@jpx.com",
			password: "password123",
		});

	if (authErr || !authData.user) {
		console.error("❌ Failed to log in test user:", authErr?.message);
		process.exit(1);
	}

	const { data: profile, error } = await client
		.from("profiles")
		.select("*, club_id")
		.eq("id", authData.user.id)
		.single();

	if (error || !profile) {
		console.error("❌ Failed to fetch test user profile:", error?.message);
		process.exit(1);
	}

	const userId = profile.id;
	const clubId = profile.club_id;
	console.log(`✅ Using Athlete: ${profile.display_name} (ID: ${userId})`);

	// 3. Initialize Agent
	console.log("\nInitializing AI Agent...");
	let agent;
	try {
		agent = await createAgent(client, userId, clubId);
		console.log("✅ Agent initialized successfully.\n");
	} catch (err) {
		console.error("❌ Failed to initialize agent:", err);
		process.exit(1);
	}

	// 4. Run Test Prompts
	const prompts = [
		"Please remember this fact: I am training for an Ironman 70.3 in September and I prefer morning workouts. Save this memory.",
		"Can you search my past workouts and tell me the last time I did a threshold run? Look for anything related to feeling exhausted or tired.",
		"Please analyze my biometric trends over the last 30 days. Am I sleeping well?",
		"Can you forecast my injury risk using my recent training load (ACWR)?",
	];

	const messageHistory: any[] = [];

	for (let i = 0; i < prompts.length; i++) {
		const prompt = prompts[i];
		console.log(`\n==================================================`);
		console.log(`🗣️  USER: ${prompt}`);
		console.log(`==================================================\n`);

		const humanMessage = new HumanMessage({ content: prompt });
		messageHistory.push(humanMessage);

		try {
			const response = await agent.invoke({ messages: messageHistory });
			const aiMessage = response.messages[response.messages.length - 1];

			console.log(`🤖 AI: ${aiMessage.content}\n`);

			// Log tool calls if any
			if (
				"tool_calls" in aiMessage &&
				Array.isArray((aiMessage as any).tool_calls) &&
				(aiMessage as any).tool_calls.length > 0
			) {
				console.log(`🛠️ Tools Called:`);
				(aiMessage as any).tool_calls.forEach((tc: any) => {
					console.log(`   - ${tc.name} (${JSON.stringify(tc.args)})`);
				});
			}

			// keep AI message in history
			messageHistory.push(aiMessage);
		} catch (err) {
			console.error(
				`❌ Error during agent invocation for prompt ${i + 1}:`,
				err,
			);
		}
	}

	console.log("\n✅ AI Functional Tests Completed.");
	process.exit(0);
}

runTest();
