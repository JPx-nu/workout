import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserClientMock = vi.hoisted(() => vi.fn());
const getOrCreateConversationMock = vi.hoisted(() => vi.fn());
const loadHistoryMock = vi.hoisted(() => vi.fn());
const saveMessagesMock = vi.hoisted(() => vi.fn());
const updateConversationTitleMock = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() => vi.fn());
const extractMemoriesMock = vi.hoisted(() => vi.fn());
const tryHandleQuickWorkoutLogMock = vi.hoisted(() => vi.fn());
const tryHandleQuickWorkoutLogFollowUpMock = vi.hoisted(() => vi.fn());
const validateAIConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../config/ai.js", () => ({
	AI_CONFIG: {
		model: { historyLimit: 40 },
		agent: {
			maxGraphSteps: 15,
			requestTimeoutMs: 90_000,
		},
		azure: { deploymentName: "gpt-5-mini" },
		safety: {
			maxInputLength: 4000,
			lowConfidenceThreshold: 0.6,
		},
	},
	validateAIConfig: validateAIConfigMock,
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
	getJwt: () => "jwt-token",
}));

vi.mock("../services/ai/supabase.js", () => ({
	createUserClient: createUserClientMock,
}));

vi.mock("../services/ai/conversation.js", () => ({
	getOrCreateConversation: getOrCreateConversationMock,
	loadHistory: loadHistoryMock,
	saveMessages: saveMessagesMock,
	updateConversationTitle: updateConversationTitleMock,
}));

vi.mock("../services/ai/graph.js", () => ({
	createAgent: createAgentMock,
	toBaseMessages: () => [],
}));

vi.mock("../services/ai/memory-extractor.js", () => ({
	extractMemories: extractMemoriesMock,
}));

vi.mock("../services/ai/quick-workout-log.js", () => ({
	tryHandleQuickWorkoutLog: tryHandleQuickWorkoutLogMock,
	tryHandleQuickWorkoutLogFollowUp: tryHandleQuickWorkoutLogFollowUpMock,
}));

import { aiStreamRoutes } from "../routes/ai/stream.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/ai", aiStreamRoutes);
	return app;
}

async function makeStreamRequest(app: Hono, body: unknown): Promise<Response> {
	return await app.request("/api/ai/stream", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeUserMessage(text: string, id = "user-1") {
	return {
		id,
		role: "user",
		parts: [{ type: "text", text }],
	};
}

describe("aiStreamRoutes", () => {
	beforeEach(() => {
		createUserClientMock.mockReset();
		getOrCreateConversationMock.mockReset();
		loadHistoryMock.mockReset();
		saveMessagesMock.mockReset();
		updateConversationTitleMock.mockReset();
		createAgentMock.mockReset();
		extractMemoriesMock.mockReset();
		tryHandleQuickWorkoutLogMock.mockReset();
		tryHandleQuickWorkoutLogFollowUpMock.mockReset();
		validateAIConfigMock.mockReset();

		validateAIConfigMock.mockReturnValue({ valid: true, missing: [] });
		createUserClientMock.mockReturnValue({});
		getOrCreateConversationMock.mockResolvedValue({
			id: "conversation-1",
		});
		loadHistoryMock.mockResolvedValue([]);
		saveMessagesMock.mockResolvedValue(undefined);
		updateConversationTitleMock.mockResolvedValue(undefined);
		extractMemoriesMock.mockResolvedValue(undefined);
		tryHandleQuickWorkoutLogFollowUpMock.mockResolvedValue(null);
		tryHandleQuickWorkoutLogMock.mockResolvedValue(null);
	});

	// ── Validation ─────────────────────────────────────────────

	it("returns 400 when messages array is missing", async () => {
		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe("Validation failed");
	});

	it("returns 400 when message text is empty", async () => {
		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "" }] }],
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe("Validation failed");
	});

	// ── AI config not ready ────────────────────────────────────

	it("returns a friendly message when AI config is missing", async () => {
		validateAIConfigMock.mockReturnValue({
			valid: false,
			missing: ["AZURE_OPENAI_API_KEY"],
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("hello")],
		});

		expect(response.status).toBe(200);
		const body = (await response.json()) as { content: string; metadata: { missing: string[] } };
		expect(body.content).toContain("not yet configured");
		expect(body.metadata.missing).toContain("AZURE_OPENAI_API_KEY");
	});

	// ── Safety blocked input ───────────────────────────────────

	it("returns 400 when message exceeds max length", async () => {
		const longMessage = "a".repeat(4001);
		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage(longMessage)],
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe("Validation failed");
	});

	// ── Quick workout log fast path ────────────────────────────

	it("bypasses the agent for a quick completed workout log", async () => {
		tryHandleQuickWorkoutLogMock.mockResolvedValue({
			content:
				"Logged your 30-minute 5 km run from yesterday. If you want, send a note or average HR and I'll add it.",
			metadata: {
				model: "fast-path",
				intent: "training",
				fastPath: "quick_workout_log",
			},
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("log a 30 minute 5km run from yesterday")],
		});

		expect(response.status).toBe(200);
		expect(createAgentMock).not.toHaveBeenCalled();

		const body = await response.text();
		expect(body).toContain("Logged your 30-minute 5 km run from yesterday");

		expect(saveMessagesMock).toHaveBeenCalledWith({}, "conversation-1", [
			expect.objectContaining({
				role: "assistant",
				metadata: expect.objectContaining({
					fastPath: "quick_workout_log",
				}),
			}),
		]);
	});

	it("uses quick log follow-up when history has an awaiting-details assistant message", async () => {
		const convUuid = "11111111-1111-4111-8111-111111111111";
		getOrCreateConversationMock.mockResolvedValue({ id: convUuid });
		loadHistoryMock.mockResolvedValue([
			{
				id: "msg-1",
				conversation_id: convUuid,
				role: "assistant",
				content: "Logged your run.",
				metadata: {
					fastPath: "quick_workout_log",
					loggedWorkoutId: "workout-1",
					awaitingOptionalDetails: true,
				},
				created_at: "2026-03-18T09:00:00Z",
			},
		]);
		tryHandleQuickWorkoutLogFollowUpMock.mockResolvedValue({
			content: "Added that note to your run.",
			metadata: {
				model: "fast-path",
				intent: "training",
				fastPath: "quick_workout_log_follow_up",
			},
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("felt great today")],
			conversationId: convUuid,
		});

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("Added that note to your run.");
		expect(createAgentMock).not.toHaveBeenCalled();
	});

	// ── Full agent streaming ───────────────────────────────────

	it("streams only llmCall text and filters internal graph chatter", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "Clean" }, { langgraph_node: "llmCall" }];
				yield [{ content: " ACCEPT" }, { langgraph_node: "reflectNode" }];
				yield [{ name: "schedule_workout" }, { langgraph_node: "tools" }];
				yield [{ content: " answer" }, { langgraph_node: "llmCall" }];
			},
			getExecutionStats: () => ({
				graphDecisions: 2,
				toolCallCount: 1,
				reflectionRevisions: 0,
				endedByToolCap: false,
				endedByRepeatedToolSignature: false,
				endedByReflectionCap: false,
			}),
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("why so weird?")],
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Conversation-Id")).toBe("conversation-1");

		const body = await response.text();
		expect(body).toContain("Clean");
		expect(body).toContain("answer");
		expect(body).not.toContain("Self-Evaluation");
		expect(body).not.toContain("ACCEPT");

		expect(saveMessagesMock).toHaveBeenCalledWith({}, "conversation-1", [
			expect.objectContaining({
				role: "assistant",
				content: "Clean answer",
			}),
		]);
	});

	it("sets streaming response headers", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "hi" }, { langgraph_node: "llmCall" }];
			},
			getExecutionStats: () => ({
				graphDecisions: 1,
				toolCallCount: 0,
				reflectionRevisions: 0,
				endedByToolCap: false,
				endedByRepeatedToolSignature: false,
				endedByReflectionCap: false,
			}),
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("hello")],
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Accel-Buffering")).toBe("no");
		expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
		expect(response.headers.get("X-Conversation-Id")).toBe("conversation-1");
	});

	it("passes conversationId from request body to getOrCreateConversation", async () => {
		const convUuid = "22222222-2222-4222-8222-222222222222";
		tryHandleQuickWorkoutLogMock.mockResolvedValue({
			content: "Done",
			metadata: { model: "fast-path", fastPath: "quick_workout_log" },
		});

		const app = createAuthedApp();
		await makeStreamRequest(app, {
			messages: [makeUserMessage("log a swim")],
			conversationId: convUuid,
		});

		expect(getOrCreateConversationMock).toHaveBeenCalledWith({}, "athlete-1", "club-1", convUuid);
	});

	it("extracts image URLs from file parts and passes them to the agent", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "I see your image" }, { langgraph_node: "llmCall" }];
			},
			getExecutionStats: () => ({
				graphDecisions: 1,
				toolCallCount: 0,
				reflectionRevisions: 0,
				endedByToolCap: false,
				endedByRepeatedToolSignature: false,
				endedByReflectionCap: false,
			}),
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [
				{
					id: "user-1",
					role: "user",
					parts: [
						{ type: "text", text: "What do you see?" },
						{
							type: "file",
							mediaType: "image/jpeg",
							url: "https://storage.example.com/photo.jpg",
						},
					],
				},
			],
		});

		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("I see your image");

		// Verify user message was saved with imageUrls metadata
		expect(saveMessagesMock).toHaveBeenCalledWith({}, "conversation-1", [
			expect.objectContaining({
				role: "user",
				metadata: { imageUrls: ["https://storage.example.com/photo.jpg"] },
			}),
		]);
	});

	// ── Agent error handling ───────────────────────────────────

	it("returns 500 when agent creation fails", async () => {
		createAgentMock.mockRejectedValue(new Error("Azure OpenAI connection failed"));

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("hello")],
		});

		// createAgent throws before the stream is created, so the error propagates
		// to Hono's global error handler (which in production returns problem+json).
		expect(response.status).toBe(500);
	});

	it("includes error in stream when agent stream throws mid-execution", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "Starting" }, { langgraph_node: "llmCall" }];
				throw new Error("Stream interrupted");
			},
			getExecutionStats: () => ({
				graphDecisions: 1,
				toolCallCount: 0,
				reflectionRevisions: 0,
				endedByToolCap: false,
				endedByRepeatedToolSignature: false,
				endedByReflectionCap: false,
			}),
		});

		const app = createAuthedApp();
		const response = await makeStreamRequest(app, {
			messages: [makeUserMessage("hello")],
		});

		// Stream started successfully so status is 200, but error is embedded in the stream
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("Starting");

		// Error message should have been saved
		expect(saveMessagesMock).toHaveBeenCalledWith(
			{},
			"conversation-1",
			expect.arrayContaining([
				expect.objectContaining({
					role: "assistant",
					metadata: expect.objectContaining({ error: true, phase: "stream" }),
				}),
			]),
		);
	});

	// ── Conversation title ─────────────────────────────────────

	it("updates conversation title on first message (empty history)", async () => {
		tryHandleQuickWorkoutLogMock.mockResolvedValue({
			content: "Done",
			metadata: { model: "fast-path", fastPath: "quick_workout_log" },
		});

		const app = createAuthedApp();
		await makeStreamRequest(app, {
			messages: [makeUserMessage("log a 5km run")],
		});

		expect(updateConversationTitleMock).toHaveBeenCalledWith({}, "conversation-1", "log a 5km run");
	});

	it("does not update conversation title when history exists", async () => {
		loadHistoryMock.mockResolvedValue([{ id: "msg-old", role: "user", content: "previous" }]);
		tryHandleQuickWorkoutLogMock.mockResolvedValue({
			content: "Done",
			metadata: { model: "fast-path", fastPath: "quick_workout_log" },
		});

		const app = createAuthedApp();
		await makeStreamRequest(app, {
			messages: [makeUserMessage("log a swim")],
			conversationId: "conversation-1",
		});

		expect(updateConversationTitleMock).not.toHaveBeenCalled();
	});
});
