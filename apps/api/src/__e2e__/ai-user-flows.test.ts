import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const aiState = vi.hoisted(() => ({
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

function resetAiState() {
	aiState.conversationCounter = 0;
	aiState.messageCounter = 0;
	aiState.workoutCounter = 0;
	aiState.conversations = [];
	aiState.messages = [];
	aiState.workouts = [];
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
				aiState.conversations.find(
					(conversation) =>
						conversation.id === conversationId && conversation.athlete_id === userId,
				);
			if (existing) {
				return existing;
			}

			const created: StoredConversation = {
				id: createTestUuid(++aiState.conversationCounter),
				athlete_id: userId,
				club_id: clubId,
				title: null,
				created_at: "2026-03-18T09:00:00.000Z",
			};
			aiState.conversations.push(created);
			return created;
		},
	),
	listConversations: vi.fn(async () => []),
	loadHistory: vi.fn(async (_client: unknown, conversationId: string): Promise<StoredMessage[]> => {
		return aiState.messages.filter((message) => message.conversation_id === conversationId);
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
				aiState.messages.push({
					id: `message-${++aiState.messageCounter}`,
					conversation_id: conversationId,
					role: message.role,
					content: message.content,
					metadata: message.metadata ?? null,
					created_at: `2026-03-18T09:00:${String(aiState.messageCounter).padStart(2, "0")}.000Z`,
				});
			}
		},
	),
	updateConversationTitle: vi.fn(
		async (_client: unknown, conversationId: string, firstMessage: string): Promise<void> => {
			const conversation = aiState.conversations.find((item) => item.id === conversationId);
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
				id: createTestUuid(++aiState.workoutCounter + 100),
				created_at: "2026-03-18T09:00:00.000Z",
			};
			aiState.workouts.push(created);
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
			const workout = aiState.workouts.find(
				(item) => item.id === workoutId && item.athlete_id === userId,
			);
			if (!workout) {
				throw new Error(`Failed to update workout: workout ${workoutId} not found`);
			}

			Object.assign(workout, updates);
			return workout;
		},
	),
}));

import { aiRoutes } from "../routes/ai/chat.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/ai", aiRoutes);
	return app;
}

describe("AI coach user flows", () => {
	beforeEach(() => {
		resetAiState();
		createAgentMock.mockReset();
		extractMemoriesMock.mockReset();
		createAgentMock.mockImplementation(async () => {
			throw new Error("Agent should not run for quick workout log e2e scenarios");
		});
		extractMemoriesMock.mockResolvedValue(undefined);
	});

	it("logs a completed workout and accepts a follow-up note in the same conversation", async () => {
		const app = createAuthedApp();

		const firstResponse = await app.request("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: "log a 30 minute 5km run from yesterday",
			}),
		});

		expect(firstResponse.status).toBe(200);
		const firstBody = await firstResponse.text();
		expect(firstBody).toContain("Logged your 30-minute 5 km run from yesterday.");
		expect(aiState.workouts).toHaveLength(1);
		expect(aiState.workouts[0]).toMatchObject({
			activity_type: "RUN",
			duration_s: 1800,
			distance_m: 5000,
			notes: null,
		});
		expect(createAgentMock).not.toHaveBeenCalled();

		const conversationId = aiState.conversations[0]?.id;
		expect(conversationId).toBeTruthy();

		const followUpResponse = await app.request("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: "just standard maintenance",
				conversationId,
			}),
		});

		expect(followUpResponse.status).toBe(200);
		const followUpBody = await followUpResponse.text();
		expect(followUpBody).toContain("Added that note to your run.");
		expect(aiState.workouts[0]?.notes).toBe("just standard maintenance");
		expect(aiState.messages.filter((message) => message.role === "assistant")).toEqual([
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
});
