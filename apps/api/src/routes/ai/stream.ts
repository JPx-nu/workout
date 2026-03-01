// ============================================================
// AI SDK Streaming Endpoint — LangGraph → AI SDK bridge
// Uses @ai-sdk/langchain adapter for standard UI message streaming
// ============================================================

import { toUIMessageStream } from "@ai-sdk/langchain";
import { HumanMessage } from "@langchain/core/messages";
import { ChatMessageInput } from "@triathlon/types";
import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { Hono } from "hono";
import { AI_CONFIG, validateAIConfig } from "../../config/ai.js";
import { createLogger } from "../../lib/logger.js";
import { getAuth } from "../../middleware/auth.js";
import {
	getOrCreateConversation,
	loadHistory,
	saveMessages,
	updateConversationTitle,
} from "../../services/ai/conversation.js";
import { createAgent, toBaseMessages } from "../../services/ai/graph.js";
import { extractMemories } from "../../services/ai/memory-extractor.js";
import { checkInput, classifyIntent, processOutput } from "../../services/ai/safety.js";
import { createUserClient } from "../../services/ai/supabase.js";

const log = createLogger({ module: "ai-stream" });

export const aiStreamRoutes = new Hono();

// ── AI Coach streaming endpoint (AI SDK protocol) ────────────
aiStreamRoutes.post("/stream", async (c) => {
	const body = await c.req.json();

	// Extract last user message from AI SDK UIMessage format
	const uiMessages: UIMessage[] = body.messages ?? [];
	const lastUserMsg = uiMessages.filter((m) => m.role === "user").pop();

	const messageText =
		lastUserMsg?.parts
			?.filter((p: { type: string }): p is { type: "text"; text: string } => p.type === "text")
			.map((p) => p.text)
			.join("\n") || "";

	const reqConversationId: string | undefined = body.conversationId;

	// Extract image URLs from file parts (AI SDK uses FileUIPart with type: 'file')
	const imageUrls: string[] =
		lastUserMsg?.parts
			?.filter(
				(p: { type: string }): p is { type: "file"; mediaType: string; url: string } =>
					p.type === "file" &&
					"mediaType" in p &&
					(p as { mediaType: string }).mediaType.startsWith("image/"),
			)
			.map((p) => p.url) ?? [];

	// ── Input validation ─────────────────────────────────────
	const parsed = ChatMessageInput.safeParse({
		message: messageText,
		conversationId: reqConversationId,
		...(imageUrls.length > 0 && { imageUrls }),
	});

	if (!parsed.success) {
		return c.json(
			{
				error: "Validation failed",
				issues: parsed.error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
			},
			400,
		);
	}

	const { message, conversationId } = parsed.data;

	// ── Safety check ─────────────────────────────────────────
	const safetyCheck = checkInput(message);
	if (safetyCheck.blocked) {
		return c.json({
			role: "assistant",
			content: safetyCheck.response,
			conversationId: conversationId || crypto.randomUUID(),
			metadata: { model: "safety-guard", blocked: true, reason: safetyCheck.reason },
		});
	}

	// ── Validate AI config ───────────────────────────────────
	const configCheck = validateAIConfig();
	if (!configCheck.valid) {
		return c.json({
			role: "assistant",
			content: "AI Coach is not yet configured. Please set up the required environment variables.",
			metadata: { model: "none", error: "missing_config", missing: configCheck.missing },
		});
	}

	// ── Auth & Supabase client ───────────────────────────────
	const auth = getAuth(c);
	const jwt = c.req.header("Authorization")?.replace("Bearer ", "") || "";
	const client = createUserClient(jwt);

	// ── Conversation persistence ─────────────────────────────
	const conversation = await getOrCreateConversation(
		client,
		auth.userId,
		auth.clubId,
		conversationId,
	);
	const history = await loadHistory(client, conversation.id, AI_CONFIG.model.historyLimit);

	// Save user message and conditionally update title concurrently
	const userMsgMetadata = imageUrls.length > 0 ? { imageUrls } : undefined;
	await Promise.all([
		saveMessages(client, conversation.id, [
			{ role: "user", content: message, metadata: userMsgMetadata },
		]),
		history.length === 0
			? updateConversationTitle(client, conversation.id, message)
			: Promise.resolve(),
	]);

	// ── Intent classification ────────────────────────────────
	const intent = classifyIntent(message);

	// ── Create agent and prepare messages ─────────────────────
	const agent = await createAgent(client, auth.userId, auth.clubId, message);
	const historyMessages = toBaseMessages(history);

	// Build multimodal user content if images attached
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

	const inputMessages = [...historyMessages, new HumanMessage({ content: userContent })];

	// ── Stream with AI SDK adapter ───────────────────────────
	const graphStream = await agent.stream(
		{ messages: inputMessages },
		{ streamMode: ["values", "messages"] as const },
	);

	return createUIMessageStreamResponse({
		stream: toUIMessageStream(graphStream, {
			onFinal: async (completion) => {
				// Post-processing: save the assistant response and extract memories
				if (!completion) return;
				try {
					const processed = processOutput(completion, {
						confidence: 0.85,
						hasMedicalContent: intent === "medical",
					});

					await saveMessages(client, conversation.id, [
						{
							role: "assistant",
							content: processed.content,
							metadata: {
								model: AI_CONFIG.azure.deploymentName,
								intent,
								disclaimerAdded: processed.disclaimerAdded,
							},
						},
					]);

					extractMemories(client, auth.userId, message, processed.content).catch((err) =>
						log.warn({ err }, "Background memory extraction failed"),
					);
				} catch (err) {
					log.error({ err }, "Post-stream processing failed");
				}
			},
		}),
		headers: {
			"X-Accel-Buffering": "no",
			"Cache-Control": "no-cache, no-transform",
			"X-Conversation-Id": conversation.id,
		},
	});
});
