import { HumanMessage } from "@langchain/core/messages";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { AI_CONFIG, validateAIConfig } from "../../config/ai.js";
import { getAuth } from "../../middleware/auth.js";
import {
	getOrCreateConversation,
	listConversations,
	loadHistory,
	saveMessages,
	updateConversationTitle,
} from "../../services/ai/conversation.js";
import { createAgent, toBaseMessages } from "../../services/ai/graph.js";
import {
	checkInput,
	classifyIntent,
	processOutput,
} from "../../services/ai/safety.js";
import { createUserClient } from "../../services/ai/supabase.js";

export const aiRoutes = new Hono();

// ── AI Coach chat endpoint (SSE streaming) ──────────────────
aiRoutes.post("/chat", async (c) => {
	const body = await c.req.json();

	// ── Input validation ─────────────────────────────────────
	const message = typeof body.message === "string" ? body.message.trim() : "";
	const conversationId =
		typeof body.conversationId === "string" ? body.conversationId : undefined;
	const imageUrls: string[] = Array.isArray(body.imageUrls)
		? body.imageUrls
			.filter((u: unknown): u is string => typeof u === "string")
			.slice(0, AI_CONFIG.uploads.maxImagesPerMessage)
		: [];

	if (!message) {
		return c.json({ error: "Message is required" }, 400);
	}

	if (message.length > AI_CONFIG.safety.maxInputLength) {
		return c.json(
			{
				error: `Message too long (max ${AI_CONFIG.safety.maxInputLength} chars)`,
			},
			400,
		);
	}

	// ── Safety check ─────────────────────────────────────────
	const safetyCheck = checkInput(message);
	if (safetyCheck.blocked) {
		return c.json({
			role: "assistant",
			content: safetyCheck.response,
			conversationId: conversationId || crypto.randomUUID(),
			metadata: {
				model: "safety-guard",
				blocked: true,
				reason: safetyCheck.reason,
			},
		});
	}

	// ── Validate AI config ───────────────────────────────────
	const configCheck = validateAIConfig();
	if (!configCheck.valid) {
		return c.json({
			role: "assistant",
			content:
				"⚠️ AI Coach is not yet configured. Please set up the required environment variables.",
			conversationId: conversationId || crypto.randomUUID(),
			metadata: {
				model: "none",
				error: "missing_config",
				missing: configCheck.missing,
			},
		});
	}

	// ── Auth & Supabase client ───────────────────────────────
	const auth = getAuth(c);
	const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
	// User-scoped client — carries the user's JWT so auth.uid() works for RLS
	const client = createUserClient(jwt);

	// ── Conversation persistence ─────────────────────────────
	const conversation = await getOrCreateConversation(
		client,
		auth.userId,
		auth.clubId,
		conversationId,
	);

	// Load history for context
	const history = await loadHistory(
		client,
		conversation.id,
		AI_CONFIG.model.historyLimit,
	);

	// Save user message and conditionally update title concurrently for lower latency
	const userMsgMetadata = imageUrls.length > 0 ? { imageUrls } : undefined;

	const savePromise = saveMessages(client, conversation.id, [
		{ role: "user", content: message, metadata: userMsgMetadata },
	]);
	const titlePromise =
		history.length === 0
			? updateConversationTitle(client, conversation.id, message)
			: Promise.resolve();

	await Promise.all([savePromise, titlePromise]);

	// ── Intent classification (for metadata) ─────────────────
	const intent = classifyIntent(message);

	// ── LangGraph agent invocation with SSE streaming ────────
	return streamSSE(c, async (stream) => {
		// Disable Azure App Service / IIS / ARR response buffering for SSE
		c.header("X-Accel-Buffering", "no");
		c.header("Cache-Control", "no-cache, no-transform");
		try {
			const agent = await createAgent(client, auth.userId, auth.clubId);

			// Build input with history + new user message
			// toBaseMessages handles multimodal content via metadata.imageUrls
			const historyMessages = toBaseMessages(history);

			// Build the new user message — multimodal if images are attached
			const userContent =
				imageUrls.length > 0
					? [
						{ type: "text" as const, text: message },
						...imageUrls.map((url) => ({
							type: "image_url" as const,
							image_url: { url },
						})),
					]
					: message;

			const inputMessages = [
				...historyMessages,
				new HumanMessage({ content: userContent }),
			];

			let fullResponse = "";
			let isRevisePass = false;
			let notifiedReflection = false;

			// Stream the agent's response
			const agentStream = await agent.stream(
				{ messages: inputMessages },
				{ streamMode: "messages" },
			);

			// Send conversation ID first
			await stream.writeSSE({
				event: "metadata",
				data: JSON.stringify({
					conversationId: conversation.id,
					intent,
					athleteId: auth.userId,
				}),
			});

			for await (const [msgChunk, metadata] of agentStream) {
				// Only stream content from the LLM node (not tool calls/results)
				if (
					metadata.langgraph_node === "llmCall" &&
					msgChunk.content &&
					typeof msgChunk.content === "string"
				) {
					if (isRevisePass) {
						// Clear the frontend and reset our accumulated buffer for the new draft
						await stream.writeSSE({ event: "clear", data: JSON.stringify({}) });
						fullResponse = "";
						isRevisePass = false;
						notifiedReflection = false;
					}

					fullResponse += msgChunk.content;
					await stream.writeSSE({
						event: "delta",
						data: JSON.stringify({ content: msgChunk.content }),
					});
				}

				if (metadata.langgraph_node === "reflectNode") {
					isRevisePass = true;
					if (!notifiedReflection) {
						notifiedReflection = true;
						await stream.writeSSE({
							event: "tool",
							data: JSON.stringify({
								tool: "Self-Evaluation",
								status: "completed",
							}),
						});
					}
				}

				// Notify frontend about tool usage
				if (metadata.langgraph_node === "tools" && msgChunk.name) {
					await stream.writeSSE({
						event: "tool",
						data: JSON.stringify({
							tool: msgChunk.name,
							status: "completed",
						}),
					});
				}
			}

			// ── Output safety processing ─────────────────────
			const processed = processOutput(fullResponse, {
				confidence: 0.85,
				hasMedicalContent: intent === "medical",
			});

			// If safety modified the output, send the corrected version
			if (processed.content !== fullResponse) {
				await stream.writeSSE({
					event: "correction",
					data: JSON.stringify({ content: processed.content }),
				});
				fullResponse = processed.content;
			}

			// Save assistant response
			await saveMessages(client, conversation.id, [
				{
					role: "assistant",
					content: fullResponse,
					metadata: {
						model: AI_CONFIG.azure.deploymentName,
						intent,
						disclaimerAdded: processed.disclaimerAdded,
						piiRedacted: processed.piiRedacted,
					},
				},
			]);

			// Signal completion
			await stream.writeSSE({
				event: "done",
				data: JSON.stringify({
					conversationId: conversation.id,
					disclaimerAdded: processed.disclaimerAdded,
				}),
			});
		} catch (err) {
			console.error("AI Agent error:", err);
			const errorMessage =
				"❌ Sorry, I encountered an error processing your request. Please try again.";

			await stream.writeSSE({
				event: "error",
				data: JSON.stringify({ message: errorMessage }),
			});

			// Still save the error as a response for context
			await saveMessages(client, conversation.id, [
				{ role: "assistant", content: errorMessage, metadata: { error: true } },
			]);
		}
	});
});

// ── List conversations ──────────────────────────────────────
aiRoutes.get("/conversations", async (c) => {
	const auth = getAuth(c);
	const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
	const client = createUserClient(jwt);

	const conversations = await listConversations(client, auth.userId);

	return c.json({ conversations, athleteId: auth.userId });
});
