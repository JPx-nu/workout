import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end user-flow tests for the /api/ai/stream endpoint.
 *
 * These exercise the same Vercel AI SDK protocol path that the web client uses
 * (createUIMessageStream + createUIMessageStreamResponse) with a fake agent and
 * in-memory conversation/workout state, validating the full request → stream →
 * persistence flow.
 */

type StoredConversation = {
	id: string;
	athlete_id: string;
	club_id: string;
	title: string | null;
	created_at: string;
};

type StoredMessage = {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system";
	content: string;
	metadata: Record<string, unknown> | null;
	created_at: string;
};

type StoredWorkout = {
	id: string;
	athlete_id: string;
	club_id: string;
	activity_type: string;
	source: string;
	started_at: string;
	duration_s: number | null;
	distance_m: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	avg_pace_s_km: number | null;
	avg_power_w: number | null;
	calories: number | null;
	tss: number | null;
	raw_data: Record<string, unknown> | null;
	notes: string | null;
	created_at: string;
};

const createAgentMock = vi.hoisted(() => vi.fn());
const extractMemoriesMock = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
	conversationCounter: 0,
	messageCounter: 0,
	workoutCounter: 0,
	conversations: [] as StoredConversation[],
	messages: [] as StoredMessage[],
	workouts: [] as StoredWorkout[],
}));

function createTestUuid(counter: number): string {
	return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

function resetState() {
	state.conversationCounter = 0;
	state.messageCounter = 0;
	state.workoutCounter = 0;
	state.conversations = [];
	state.messages = [];
	state.workouts = [];
}

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
	validateAIConfig: () => ({ valid: true, missing: [] }),
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
	getJwt: () => "jwt-token",
}));

vi.mock("../services/ai/conversation.js", () => ({
	getOrCreateConversation: vi.fn(
		async (
			_client: unknown,
			userId: string,
			clubId: string,
			conversationId?: string,
		): Promise<StoredConversation> => {
			const existing =
				conversationId &&
				state.conversations.find((c) => c.id === conversationId && c.athlete_id === userId);
			if (existing) return existing;

			const created: StoredConversation = {
				id: createTestUuid(++state.conversationCounter),
				athlete_id: userId,
				club_id: clubId,
				title: null,
				created_at: "2026-03-18T09:00:00.000Z",
			};
			state.conversations.push(created);
			return created;
		},
	),
	loadHistory: vi.fn(async (_client: unknown, conversationId: string): Promise<StoredMessage[]> => {
		return state.messages.filter((m) => m.conversation_id === conversationId);
	}),
	saveMessages: vi.fn(
		async (
			_client: unknown,
			conversationId: string,
			messages: Array<{
				role: "user" | "assistant" | "system";
				content: string;
				metadata?: Record<string, unknown>;
			}>,
		): Promise<void> => {
			for (const message of messages) {
				state.messages.push({
					id: `message-${++state.messageCounter}`,
					conversation_id: conversationId,
					role: message.role,
					content: message.content,
					metadata: message.metadata ?? null,
					created_at: `2026-03-18T09:00:${String(state.messageCounter).padStart(2, "0")}.000Z`,
				});
			}
		},
	),
	updateConversationTitle: vi.fn(
		async (_client: unknown, conversationId: string, firstMessage: string): Promise<void> => {
			const conversation = state.conversations.find((c) => c.id === conversationId);
			if (conversation) {
				conversation.title =
					firstMessage.length > 60 ? `${firstMessage.slice(0, 57)}...` : firstMessage;
			}
		},
	),
}));

vi.mock("../services/ai/graph.js", () => ({
	createAgent: createAgentMock,
	toBaseMessages: () => [],
}));

vi.mock("../services/ai/memory-extractor.js", () => ({
	extractMemories: extractMemoriesMock,
}));

vi.mock("../services/ai/supabase.js", () => ({
	createUserClient: () => ({}),
	insertWorkout: vi.fn(
		async (_client: unknown, workout: Omit<StoredWorkout, "id" | "created_at">) => {
			const created: StoredWorkout = {
				...workout,
				id: createTestUuid(++state.workoutCounter + 100),
				created_at: "2026-03-18T09:00:00.000Z",
			};
			state.workouts.push(created);
			return created;
		},
	),
	updateWorkout: vi.fn(
		async (
			_client: unknown,
			workoutId: string,
			userId: string,
			updates: Partial<Pick<StoredWorkout, "avg_hr" | "notes" | "tss" | "raw_data">>,
		) => {
			const workout = state.workouts.find((w) => w.id === workoutId && w.athlete_id === userId);
			if (!workout) {
				throw new Error(`Failed to update workout: workout ${workoutId} not found`);
			}
			Object.assign(workout, updates);
			return workout;
		},
	),
}));

import { aiStreamRoutes } from "../routes/ai/stream.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/ai", aiStreamRoutes);
	return app;
}

function makeUIMessage(text: string, id: string) {
	return {
		id,
		role: "user",
		parts: [{ type: "text", text }],
	};
}

describe("AI stream user flows (Vercel AI SDK protocol)", () => {
	beforeEach(() => {
		resetState();
		createAgentMock.mockReset();
		extractMemoriesMock.mockReset();
		createAgentMock.mockImplementation(async () => {
			throw new Error("Agent should not run for quick workout log e2e scenarios");
		});
		extractMemoriesMock.mockResolvedValue(undefined);
	});

	it("logs a completed workout via quick-log fast path and accepts a follow-up note", async () => {
		const app = createAuthedApp();

		// Step 1: Quick log a run
		const firstResponse = await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [makeUIMessage("log a 30 minute 5km run from yesterday", "msg-1")],
			}),
		});

		expect(firstResponse.status).toBe(200);
		const firstBody = await firstResponse.text();
		expect(firstBody).toContain("Logged your 30-minute 5 km run from yesterday.");
		expect(state.workouts).toHaveLength(1);
		expect(state.workouts[0]).toMatchObject({
			activity_type: "RUN",
			duration_s: 1800,
			distance_m: 5000,
			notes: null,
		});
		expect(createAgentMock).not.toHaveBeenCalled();

		const conversationId = state.conversations[0]?.id;
		expect(conversationId).toBeTruthy();

		// Step 2: Follow up with a note
		const followUpResponse = await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [
					makeUIMessage("log a 30 minute 5km run from yesterday", "msg-1"),
					makeUIMessage("just standard maintenance", "msg-2"),
				],
				conversationId,
			}),
		});

		expect(followUpResponse.status).toBe(200);
		const followUpBody = await followUpResponse.text();
		expect(followUpBody).toContain("Added that note to your run.");
		expect(state.workouts[0]?.notes).toBe("just standard maintenance");

		// Verify message persistence
		const assistantMessages = state.messages.filter((m) => m.role === "assistant");
		expect(assistantMessages).toEqual([
			expect.objectContaining({
				metadata: expect.objectContaining({
					fastPath: "quick_workout_log",
					awaitingOptionalDetails: true,
				}),
			}),
			expect.objectContaining({
				metadata: expect.objectContaining({
					fastPath: "quick_workout_log_follow_up",
					awaitingOptionalDetails: false,
				}),
			}),
		]);
		expect(createAgentMock).not.toHaveBeenCalled();
	});

	it("streams a full agent response in the Vercel AI SDK protocol format", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "Based on your training, " }, { langgraph_node: "llmCall" }];
				yield [{ content: "I recommend a rest day." }, { langgraph_node: "llmCall" }];
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
		const response = await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [makeUIMessage("should I train today?", "msg-1")],
			}),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("X-Conversation-Id")).toBeTruthy();
		expect(response.headers.get("X-Accel-Buffering")).toBe("no");
		expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");

		const body = await response.text();
		expect(body).toContain("Based on your training");
		expect(body).toContain("I recommend a rest day.");

		// Verify the full response was persisted
		const saved = state.messages.find(
			(m) => m.role === "assistant" && m.content.includes("rest day"),
		);
		expect(saved).toBeTruthy();
		expect(saved?.content).toBe("Based on your training, I recommend a rest day.");
	});

	it("sets conversation title from first user message", async () => {
		createAgentMock.mockResolvedValue({
			stream: async function* () {
				yield [{ content: "Hi!" }, { langgraph_node: "llmCall" }];
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
		await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [makeUIMessage("How is my triathlon prep going?", "msg-1")],
			}),
		});

		expect(state.conversations[0]?.title).toBe("How is my triathlon prep going?");
	});

	it("handles agent error gracefully and returns 500", async () => {
		createAgentMock.mockRejectedValue(new Error("Azure OpenAI timed out"));

		const app = createAuthedApp();
		const response = await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [makeUIMessage("hello", "msg-1")],
			}),
		});

		// createAgent throws before the stream is created, so the error propagates
		// to Hono's global error handler (problem+json in production, plain text in tests).
		expect(response.status).toBe(500);
	});
});
