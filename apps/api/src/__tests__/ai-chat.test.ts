import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserClientMock = vi.hoisted(() => vi.fn());
const getOrCreateConversationMock = vi.hoisted(() => vi.fn());
const loadHistoryMock = vi.hoisted(() => vi.fn());
const listConversationsMock = vi.hoisted(() => vi.fn());
const saveMessagesMock = vi.hoisted(() => vi.fn());
const updateConversationTitleMock = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() => vi.fn());
const extractMemoriesMock = vi.hoisted(() => vi.fn());
const tryHandleQuickWorkoutLogMock = vi.hoisted(() => vi.fn());
const tryHandleQuickWorkoutLogFollowUpMock = vi.hoisted(() => vi.fn());

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

vi.mock("../services/ai/supabase.js", () => ({
	createUserClient: createUserClientMock,
}));

vi.mock("../services/ai/conversation.js", () => ({
	getOrCreateConversation: getOrCreateConversationMock,
	listConversations: listConversationsMock,
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

import { aiRoutes } from "../routes/ai/chat.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/ai", aiRoutes);
	return app;
}

describe("aiRoutes /chat", () => {
	beforeEach(() => {
		createUserClientMock.mockReset();
		getOrCreateConversationMock.mockReset();
		listConversationsMock.mockReset();
		loadHistoryMock.mockReset();
		saveMessagesMock.mockReset();
		updateConversationTitleMock.mockReset();
		createAgentMock.mockReset();
		extractMemoriesMock.mockReset();
		tryHandleQuickWorkoutLogMock.mockReset();
		tryHandleQuickWorkoutLogFollowUpMock.mockReset();

		createUserClientMock.mockReturnValue({});
		getOrCreateConversationMock.mockResolvedValue({
			id: "conversation-1",
		});
		listConversationsMock.mockResolvedValue([]);
		loadHistoryMock.mockResolvedValue([]);
		saveMessagesMock.mockResolvedValue(undefined);
		updateConversationTitleMock.mockResolvedValue(undefined);
		extractMemoriesMock.mockResolvedValue(undefined);
		tryHandleQuickWorkoutLogMock.mockResolvedValue(null);
		tryHandleQuickWorkoutLogFollowUpMock.mockResolvedValue(null);
	});

	it("bypasses the agent for a quick completed workout log over SSE", async () => {
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
		const response = await app.request("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: "log a 30 minute 5km run from yesterday",
			}),
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

	it("bypasses the agent for quick log follow-up details", async () => {
		loadHistoryMock.mockResolvedValue([
			{
				id: "assistant-1",
				conversation_id: "conversation-1",
				role: "assistant",
				content: "Logged your run.",
				metadata: {
					fastPath: "quick_workout_log",
					loggedWorkoutId: "workout-1",
					loggedActivityType: "RUN",
					awaitingOptionalDetails: true,
				},
				created_at: "2026-03-16T10:00:00Z",
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
		const response = await app.request("/api/ai/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: "just standard maintenance",
			}),
		});

		expect(response.status).toBe(200);
		expect(createAgentMock).not.toHaveBeenCalled();

		const body = await response.text();
		expect(body).toContain("Added that note to your run.");
	});
});
