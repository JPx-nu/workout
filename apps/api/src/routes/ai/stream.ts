// ============================================================
// AI SDK Streaming Endpoint — LangGraph → AI SDK bridge
// Streams only user-safe assistant text to the browser client.
// ============================================================

import { HumanMessage } from "@langchain/core/messages";
import { ChatMessageInput } from "@triathlon/types";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { Hono } from "hono";
import { AI_CONFIG, validateAIConfig } from "../../config/ai.js";
import { createLogger } from "../../lib/logger.js";
import { getAuth, getJwt } from "../../middleware/auth.js";
import {
	getOrCreateConversation,
	loadHistory,
	saveMessages,
	updateConversationTitle,
} from "../../services/ai/conversation.js";
import { createAgent, toBaseMessages } from "../../services/ai/graph.js";
import { extractMemories } from "../../services/ai/memory-extractor.js";
import {
	tryHandleQuickWorkoutLog,
	tryHandleQuickWorkoutLogFollowUp,
} from "../../services/ai/quick-workout-log.js";
import { checkInput, classifyIntent, processOutput } from "../../services/ai/safety.js";
import { createUserClient } from "../../services/ai/supabase.js";
import { getAgentErrorMessage } from "../../services/ai/utils/agent-errors.js";

const log = createLogger({ module: "ai-stream" });

export const aiStreamRoutes = new Hono();

aiStreamRoutes.post("/stream", async (c) => {
	const body = await c.req.json();

	const uiMessages: UIMessage[] = body.messages ?? [];
	const lastUserMsg = uiMessages.filter((m) => m.role === "user").pop();

	const messageText =
		lastUserMsg?.parts
			?.filter((p: { type: string }): p is { type: "text"; text: string } => p.type === "text")
			.map((p) => p.text)
			.join("\n") || "";

	const reqConversationId: string | undefined = body.conversationId;

	const imageUrls: string[] =
		lastUserMsg?.parts
			?.filter(
				(p: { type: string }): p is { type: "file"; mediaType: string; url: string } =>
					p.type === "file" &&
					"mediaType" in p &&
					(p as { mediaType: string }).mediaType.startsWith("image/"),
			)
			.map((p) => p.url) ?? [];

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

	const safetyCheck = checkInput(message);
	if (safetyCheck.blocked) {
		return c.json({
			role: "assistant",
			content: safetyCheck.response,
			conversationId: conversationId || crypto.randomUUID(),
			metadata: { model: "safety-guard", blocked: true, reason: safetyCheck.reason },
		});
	}

	const configCheck = validateAIConfig();
	if (!configCheck.valid) {
		return c.json({
			role: "assistant",
			content: "AI Coach is not yet configured. Please set up the required environment variables.",
			metadata: { model: "none", error: "missing_config", missing: configCheck.missing },
		});
	}

	const auth = getAuth(c);
	const client = createUserClient(getJwt(c));

	const conversation = await getOrCreateConversation(
		client,
		auth.userId,
		auth.clubId,
		conversationId,
	);
	const history = await loadHistory(client, conversation.id, AI_CONFIG.model.historyLimit);

	const userMsgMetadata = imageUrls.length > 0 ? { imageUrls } : undefined;
	await Promise.all([
		saveMessages(client, conversation.id, [
			{ role: "user", content: message, metadata: userMsgMetadata },
		]),
		history.length === 0
			? updateConversationTitle(client, conversation.id, message)
			: Promise.resolve(),
	]);

	const quickWorkoutLogFollowUp = await tryHandleQuickWorkoutLogFollowUp({
		client,
		userId: auth.userId,
		message,
		history,
	});
	const quickWorkoutLog =
		quickWorkoutLogFollowUp ??
		(await tryHandleQuickWorkoutLog({
		client,
		userId: auth.userId,
		clubId: auth.clubId,
		message,
	}));
	if (quickWorkoutLog) {
		await saveMessages(client, conversation.id, [
			{
				role: "assistant",
				content: quickWorkoutLog.content,
				metadata: quickWorkoutLog.metadata,
			},
		]);

		const stream = createUIMessageStream({
			originalMessages: uiMessages,
			execute: async ({ writer }) => {
				const responseMessageId = crypto.randomUUID();

				writer.write({
					type: "message-metadata",
					messageMetadata: {
						conversationId: conversation.id,
						intent: "training",
						athleteId: auth.userId,
						fastPath: "quick_workout_log",
					},
				});
				writer.write({ type: "text-start", id: responseMessageId });
				writer.write({
					type: "text-delta",
					id: responseMessageId,
					delta: quickWorkoutLog.content,
				});
				writer.write({ type: "text-end", id: responseMessageId });
			},
		});

		return createUIMessageStreamResponse({
			stream,
			headers: {
				"X-Accel-Buffering": "no",
				"Cache-Control": "no-cache, no-transform",
				"X-Conversation-Id": conversation.id,
			},
		});
	}

	const intent = classifyIntent(message);
	const agent = await createAgent(client, auth.userId, auth.clubId, message);
	const runStartedAt = Date.now();
	const requestAbortController = new AbortController();
	const requestTimeoutId = setTimeout(
		() => requestAbortController.abort(),
		AI_CONFIG.agent.requestTimeoutMs,
	);
	const historyMessages = toBaseMessages(history);

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

	try {
		const stream = createUIMessageStream({
			originalMessages: uiMessages,
			execute: async ({ writer }) => {
				const responseMessageId = crypto.randomUUID();
				let startedText = false;
				let fullResponse = "";

				writer.write({
					type: "message-metadata",
					messageMetadata: {
						conversationId: conversation.id,
						intent,
						athleteId: auth.userId,
					},
				});

				try {
					const agentStream = await agent.stream(
						{ messages: inputMessages },
						{
							streamMode: "messages",
							recursionLimit: AI_CONFIG.agent.maxGraphSteps,
							signal: requestAbortController.signal,
						},
					);

					for await (const [msgChunk, metadata] of agentStream) {
						// Only forward assistant text from the main LLM node.
						// This keeps internal reflection/tool chatter out of the UI.
						if (
							metadata.langgraph_node !== "llmCall" ||
							typeof msgChunk.content !== "string" ||
							msgChunk.content.length === 0
						) {
							continue;
						}

						if (!startedText) {
							writer.write({ type: "text-start", id: responseMessageId });
							startedText = true;
						}

						fullResponse += msgChunk.content;
						writer.write({
							type: "text-delta",
							id: responseMessageId,
							delta: msgChunk.content,
						});
					}

					const processed = processOutput(fullResponse, {
						confidence: 0.85,
						hasMedicalContent: intent === "medical",
					});

					if (!startedText) {
						writer.write({ type: "text-start", id: responseMessageId });
						startedText = true;
					}

					// Output safety only appends disclaimers today, so the suffix is safe to stream.
					if (processed.content !== fullResponse && processed.content.startsWith(fullResponse)) {
						const suffix = processed.content.slice(fullResponse.length);
						if (suffix.length > 0) {
							writer.write({
								type: "text-delta",
								id: responseMessageId,
								delta: suffix,
							});
						}
					}

					writer.write({ type: "text-end", id: responseMessageId });

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

					const stats = agent.getExecutionStats();
					log.info(
						{
							userId: auth.userId,
							conversationId: conversation.id,
							durationMs: Date.now() - runStartedAt,
							...stats,
						},
						"AI agent execution completed",
					);
				} catch (err) {
					const errorMessage = getAgentErrorMessage(err);
					log.error(
						{
							err,
							userId: auth.userId,
							conversationId: conversation.id,
						},
						"AI stream execution failed",
					);

					writer.write({
						type: "error",
						errorText: errorMessage,
					});

					await saveMessages(client, conversation.id, [
						{
							role: "assistant",
							content: errorMessage,
							metadata: { error: true, phase: "stream" },
						},
					]);
				} finally {
					clearTimeout(requestTimeoutId);
				}
			},
		});

		return createUIMessageStreamResponse({
			stream,
			headers: {
				"X-Accel-Buffering": "no",
				"Cache-Control": "no-cache, no-transform",
				"X-Conversation-Id": conversation.id,
			},
		});
	} catch (err) {
		clearTimeout(requestTimeoutId);
		const errorMessage = getAgentErrorMessage(err);
		log.error(
			{
				err,
				userId: auth.userId,
				conversationId: conversation.id,
			},
			"AI stream initialization failed",
		);

		await saveMessages(client, conversation.id, [
			{
				role: "assistant",
				content: errorMessage,
				metadata: { error: true, phase: "stream_init" },
			},
		]);

		return c.json(
			{
				role: "assistant",
				content: errorMessage,
				conversationId: conversation.id,
				metadata: { error: true, phase: "stream_init" },
			},
			500,
		);
	}
});
