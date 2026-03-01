// ============================================================
// LangGraph Agent — ReAct StateGraph
// The core orchestration: LLM ↔ Tools loop with streaming
// ============================================================

import { AIMessage, type BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { END, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AzureChatOpenAI } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toIsoDate } from "@triathlon/core";
import { AI_CONFIG } from "../../config/ai.js";
import { createLogger } from "../../lib/logger.js";
import { createEmbeddings } from "./utils/embeddings.js";

const log = createLogger({ module: "langgraph-agent" });

import { buildSystemPrompt } from "./prompt.js";
import {
	type AthleteMemory,
	getDailyLogs,
	getProfile,
	getRecentMemories,
	searchMemoriesBySimilarity,
} from "./supabase.js";
import { createAllTools } from "./tools/index.js";

/**
 * Creates a compiled LangGraph agent for a specific user session.
 *
 * Architecture:
 *   ┌──────────┐     tool_calls     ┌───────────┐
 *   │ llmCall  │ ──────────────────► │ toolNode  │
 *   │          │ ◄────────────────── │           │
 *   └──────────┘    tool results     └───────────┘
 *        │
 *        │ no tool_calls
 *        ▼
 *      [END]
 */
export async function createAgent(
	client: SupabaseClient,
	userId: string,
	clubId: string,
	userMessage?: string,
) {
	// Load profile + today's readiness data + pinned memories concurrently for faster initialization
	const today = toIsoDate();

	const [profile, pinnedMemories, dailyLogs] = await Promise.all([
		getProfile(client, userId),
		getRecentMemories(client, userId, 5), // Top-5 most important pinned memories
		getDailyLogs(client, userId, {
			fromDate: today,
			toDate: today,
			limit: 1,
		}),
	]);

	const todayLog = dailyLogs.length > 0 ? dailyLogs[0] : null;

	// Semantic memory recall: embed user message and find relevant memories
	const allMemories: AthleteMemory[] = [...pinnedMemories];

	if (userMessage) {
		try {
			const embeddingsModel = createEmbeddings();

			const queryEmbedding = await embeddingsModel.embedQuery(userMessage);
			const semanticResults = await searchMemoriesBySimilarity(client, userId, queryEmbedding, {
				matchThreshold: 0.4,
				matchCount: 8,
			});

			// Merge semantic results with pinned, deduplicate by content
			const pinnedContents = new Set(pinnedMemories.map((m) => m.content));
			for (const result of semanticResults) {
				if (!pinnedContents.has(result.content)) {
					allMemories.push({
						id: result.id,
						athlete_id: userId,
						category: result.category,
						content: result.content,
						importance: result.importance,
						created_at: "",
						updated_at: "",
					});
				}
			}
		} catch (err) {
			// Semantic search is best-effort — don't break the agent if it fails
			log.warn({ err }, "Semantic memory recall failed (non-fatal)");
		}
	}

	// Create LLM instance — uses AzureChatOpenAI for Azure Foundry compatibility
	const llm = new AzureChatOpenAI({
		azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
		azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
		azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
		azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
		temperature: AI_CONFIG.model.temperature,
		streaming: AI_CONFIG.features.streaming,
		maxRetries: 3,
		timeout: 60_000,
		// gpt-5-mini requires max_completion_tokens instead of max_tokens
		modelKwargs: { max_completion_tokens: AI_CONFIG.model.maxCompletionTokens },
	});

	// Create tools bound to user context
	const tools = createAllTools(client, userId, clubId);

	// Bind tools to the LLM
	const llmWithTools = llm.bindTools(tools);

	// Build the system prompt
	const systemMessage = new SystemMessage(buildSystemPrompt(profile, todayLog, allMemories));

	// ── Define graph nodes ────────────────────────────────────

	/** LLM call node: injects system prompt + invokes the model */
	async function llmCall(state: typeof MessagesAnnotation.State) {
		// Prepend system message to the conversation
		const messagesWithSystem = [systemMessage, ...state.messages];

		const response = await llmWithTools.invoke(messagesWithSystem);

		return { messages: [response] };
	}

	/** Reflection node: evaluates the draft response */
	async function reflectNode(state: typeof MessagesAnnotation.State) {
		const lastMessage = state.messages[state.messages.length - 1];
		if (!lastMessage || lastMessage._getType() !== "ai" || !lastMessage.content) {
			return { messages: [] };
		}

		const reflectionPrompt = new SystemMessage(
			`You are a Head Coach reviewing an AI assistant's drafted response to an athlete.
Evaluate the draft below for tone, safety, accuracy, and conciseness.
Does it directly answer the user's question without rambling?
If the draft is good, reply with exactly "ACCEPT".
If the draft needs changes, provide a brief, actionable critique for the assistant to revise it.
Do NOT rewrite the response yourself, just provide the critique.`,
		);

		const response = await llm.invoke([
			reflectionPrompt,
			new HumanMessage(`Draft response:\n${lastMessage.content}`),
		]);

		const critique = typeof response.content === "string" ? response.content.trim() : "";

		// If accepted, route to END — use strict match to avoid "NOT ACCEPT" false positives
		if (/^\s*ACCEPT\s*$/i.test(critique)) {
			return { messages: [] };
		}

		// If critiqued, add it as a user message so the llmCall sees the feedback and regenerates
		return {
			messages: [
				new HumanMessage(`Head Coach critique: ${critique}. Please revise your response.`),
			],
		};
	}

	/** Route: check if the LLM wants to call tools or is done drafting */
	function shouldContinue(state: typeof MessagesAnnotation.State): "tools" | "reflectNode" {
		const lastMessage = state.messages[state.messages.length - 1];

		// If the last message has tool_calls, route to the tool node
		if (
			lastMessage &&
			"tool_calls" in lastMessage &&
			(lastMessage as AIMessage).tool_calls &&
			((lastMessage as AIMessage).tool_calls?.length ?? 0) > 0
		) {
			return "tools";
		}

		return "reflectNode";
	}

	/** Route: check if reflection accepted the draft */
	function checkReflection(state: typeof MessagesAnnotation.State): "llmCall" | typeof END {
		const lastMessage = state.messages[state.messages.length - 1];

		// If the last message is from Human (the critique), we must regenerate
		if (
			lastMessage &&
			lastMessage._getType() === "human" &&
			typeof lastMessage.content === "string" &&
			lastMessage.content.includes("Head Coach critique:")
		) {
			return "llmCall";
		}

		return END;
	}

	// ── Build the graph ───────────────────────────────────────

	const toolNode = new ToolNode(tools);

	const graph = new StateGraph(MessagesAnnotation)
		.addNode("llmCall", llmCall)
		.addNode("tools", toolNode)
		.addNode("reflectNode", reflectNode)
		.addEdge("__start__", "llmCall")
		.addConditionalEdges("llmCall", shouldContinue, {
			tools: "tools",
			reflectNode: "reflectNode",
		})
		.addConditionalEdges("reflectNode", checkReflection, {
			llmCall: "llmCall",
			[END]: END,
		})
		.addEdge("tools", "llmCall")
		.compile();

	return graph;
}

/**
 * Converts stored chat history into LangChain message objects.
 * Supports multimodal messages — when metadata.imageUrls is present,
 * builds a content array with text + image_url items for vision models.
 */
export function toBaseMessages(
	history: Array<{
		role: string;
		content: string;
		metadata?: Record<string, unknown> | null;
	}>,
): BaseMessage[] {
	return history.map((msg) => {
		// Build multimodal content when images are attached
		const imageUrls = (msg.metadata?.imageUrls as string[] | undefined) ?? [];
		const content =
			msg.role === "user" && imageUrls.length > 0
				? [
						{ type: "text" as const, text: msg.content },
						...imageUrls.map((url) => ({
							type: "image_url" as const,
							image_url: { url },
						})),
					]
				: msg.content;

		switch (msg.role) {
			case "user":
				return new HumanMessage({ content });
			case "assistant":
				return new AIMessage(msg.content);
			case "system":
				return new SystemMessage(msg.content);
			default:
				return new HumanMessage({ content });
		}
	});
}
