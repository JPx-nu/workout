import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserClientMock = vi.hoisted(() => vi.fn());
const getOrCreateConversationMock = vi.hoisted(() => vi.fn());
const loadHistoryMock = vi.hoisted(() => vi.fn());
const saveMessagesMock = vi.hoisted(() => vi.fn());
const updateConversationTitleMock = vi.hoisted(() => vi.fn());
const createAgentMock = vi.hoisted(() => vi.fn());
const extractMemoriesMock = vi.hoisted(() => vi.fn());

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

import { aiStreamRoutes } from "../routes/ai/stream.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/ai", aiStreamRoutes);
	return app;
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

		createUserClientMock.mockReturnValue({});
		getOrCreateConversationMock.mockResolvedValue({
			id: "conversation-1",
		});
		loadHistoryMock.mockResolvedValue([]);
		saveMessagesMock.mockResolvedValue(undefined);
		updateConversationTitleMock.mockResolvedValue(undefined);
		extractMemoriesMock.mockResolvedValue(undefined);
	});

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
		const response = await app.request("/api/ai/stream", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				messages: [
					{
						id: "user-1",
						role: "user",
						parts: [{ type: "text", text: "why so weird?" }],
					},
				],
			}),
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
});
