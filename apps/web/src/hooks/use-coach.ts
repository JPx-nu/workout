// ============================================================
// Hook: useCoach — AI Coach integration with Vercel AI SDK 6
// Replaces manual SSE parsing with useChat from @ai-sdk/react
// ============================================================

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiConfigurationError, getApiUrl } from "@/lib/constants";
import type { CoachPageBootstrap } from "@/lib/dashboard/types";
import { createClient } from "@/lib/supabase/client";
import { type Message, suggestedPrompts } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────
const MAX_IMAGES = 3;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const STREAM_TIMEOUT_MS = 120_000;
type CoachActivity = "idle" | "connecting" | "typing";

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

function getConversationIdFromMetadata(metadata: unknown): string | undefined {
	const record = asRecord(metadata);
	return typeof record?.conversationId === "string" ? record.conversationId : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const items = value.filter((entry): entry is string => typeof entry === "string");
	return items.length > 0 ? items : undefined;
}

function toMessageMetadata(metadata: unknown): Message["metadata"] | undefined {
	const record = asRecord(metadata);
	if (!record) {
		return undefined;
	}

	const normalized: Message["metadata"] = {};

	const sources = getStringArray(record.sources);
	if (sources) {
		normalized.sources = sources;
	}

	const toolCalls = getStringArray(record.toolCalls);
	if (toolCalls) {
		normalized.toolCalls = toolCalls;
	}

	const imageUrls = getStringArray(record.imageUrls);
	if (imageUrls) {
		normalized.imageUrls = imageUrls;
	}

	if (typeof record.confidence === "number") {
		normalized.confidence = record.confidence;
	}

	return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * AI Coach hook with Vercel AI SDK 6 streaming.
 * Uses useChat for message state and AI SDK protocol streaming.
 * Keeps conversation management and file attachment logic.
 */
export function useCoach(initialState?: Partial<CoachPageBootstrap>) {
	const supabase = useMemo(() => createClient(), []);
	const tokenRef = useRef("");
	const conversationIdRef = useRef<string | undefined>(undefined);

	const [conversationId, setConversationId] = useState<string | undefined>(undefined);
	const [conversations, setConversations] = useState<
		Array<{
			id: string;
			title: string | null;
			created_at: string;
			message_count: number;
		}>
	>(initialState?.conversations ?? []);
	const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
	const previewUrlsRef = useRef<Map<File, string>>(new Map());
	const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [input, setInput] = useState("");

	// Keep conversationIdRef in sync so the fetch callback reads the latest value
	useEffect(() => {
		conversationIdRef.current = conversationId;
	}, [conversationId]);

	// ── Auth token management ────────────────────────────────
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			tokenRef.current = session?.access_token || "";
		});
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_, session) => {
			tokenRef.current = session?.access_token || "";
		});
		return () => subscription.unsubscribe();
	}, [supabase]);

	// ── AI SDK useChat for message state + streaming ─────────
	const {
		messages: aiMessages,
		sendMessage: aiSendMessage,
		setMessages: setAiMessages,
		status,
		stop,
	} = useChat({
		transport: new DefaultChatTransport({
			api: getApiUrl("/api/ai/stream"),
			headers: () => ({
				Authorization: `Bearer ${tokenRef.current}`,
			}),
			body: () => (conversationIdRef.current ? { conversationId: conversationIdRef.current } : {}),
			fetch: async (url, init) => {
				// Refresh the access token before every API call so expired
				// sessions don't produce 401s on the deployed environment.
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (session?.access_token) {
					tokenRef.current = session.access_token;
					const headers = new Headers(init?.headers);
					headers.set("Authorization", `Bearer ${session.access_token}`);
					init = { ...init, headers };
				}

				const response = await globalThis.fetch(url, init);
				if (!response.ok) {
					let message = "Failed to reach AI Coach.";
					try {
						const data = (await response.clone().json()) as {
							content?: string;
							error?: string;
							detail?: string;
						};
						message = data.content ?? data.detail ?? data.error ?? message;
					} catch {
						// Ignore parse failures and use the fallback message.
					}
					throw new Error(message);
				}
				// Capture conversationId from response header
				const convId = response.headers.get("X-Conversation-Id");
				if (convId) {
					conversationIdRef.current = convId;
					setConversationId(convId);
				}
				return response;
			},
		}),
	});

	useEffect(() => {
		const latestConversationId = [...aiMessages]
			.reverse()
			.map((message) => getConversationIdFromMetadata(message.metadata))
			.find((value): value is string => typeof value === "string");

		if (latestConversationId && latestConversationId !== conversationIdRef.current) {
			conversationIdRef.current = latestConversationId;
			setConversationId(latestConversationId);
		}
	}, [aiMessages]);

	// Map low-level AI SDK transport states to the user-facing chat states shown in the UI.
	const coachActivity: CoachActivity =
		status === "submitted" ? "connecting" : status === "streaming" ? "typing" : "idle";
	const isConnecting = coachActivity === "connecting";
	const isTyping = coachActivity === "typing";
	const isResponding = isConnecting || isTyping;

	// Protect both the connect phase and active streaming from hanging forever.
	useEffect(() => {
		if (!isResponding) {
			if (streamTimeoutRef.current) {
				clearTimeout(streamTimeoutRef.current);
				streamTimeoutRef.current = null;
			}
			return;
		}

		streamTimeoutRef.current = setTimeout(() => {
			stop();
			setError("AI Coach took too long to respond. Please try again.");
		}, STREAM_TIMEOUT_MS);

		return () => {
			if (streamTimeoutRef.current) {
				clearTimeout(streamTimeoutRef.current);
				streamTimeoutRef.current = null;
			}
		};
	}, [isResponding, stop]);

	// ── Convert AI SDK UIMessages → our Message format ───────
	const messages: Message[] = useMemo(
		() =>
			aiMessages.map((m) => ({
				id: m.id,
				role: m.role as "user" | "assistant" | "system",
				content:
					m.parts
						?.filter((p): p is { type: "text"; text: string } => p.type === "text")
						.map((p) => p.text)
						.join("") || "",
				createdAt: new Date().toISOString(),
				metadata: toMessageMetadata(m.metadata),
			})),
		[aiMessages],
	);

	// ── Load conversations list ──────────────────────────────
	const loadConversations = useCallback(async () => {
		try {
			const configError = getApiConfigurationError();
			if (configError) {
				setError(configError);
				return;
			}

			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) return;

			const res = await fetch(getApiUrl("/api/ai/conversations"), {
				headers: { Authorization: `Bearer ${session.access_token}` },
			});

			if (res.ok) {
				const data = await res.json();
				setConversations(data.conversations ?? []);
			}
		} catch {
			// Silently fail — conversations sidebar is non-critical
		}
	}, [supabase]);

	// Load on mount
	useEffect(() => {
		void loadConversations();
	}, [loadConversations]);

	// ── Load a specific conversation's messages ──────────────
	const loadConversation = useCallback(
		async (convId: string) => {
			setError(null);

			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session?.access_token) {
					setError("Not authenticated");
					return;
				}

				// Load messages from the messages table
				const { data, error: dbError } = await supabase
					.from("messages")
					.select("*")
					.eq("conversation_id", convId)
					.order("created_at", { ascending: true });

				if (dbError) throw dbError;

				// Convert DB messages to AI SDK UIMessage format for setMessages
				setAiMessages(
					(data ?? []).map(
						(m: { id: string; role: string; content: string; created_at: string }) => ({
							id: m.id,
							role: m.role as "user" | "assistant",
							parts: [{ type: "text" as const, text: m.content }],
						}),
					),
				);
				conversationIdRef.current = convId;
				setConversationId(convId);
			} catch {
				setError("Failed to load conversation");
			}
		},
		[supabase, setAiMessages],
	);

	// ── Start a new conversation ─────────────────────────────
	const newConversation = useCallback(() => {
		setAiMessages([]);
		conversationIdRef.current = undefined;
		setConversationId(undefined);
		setError(null);
		setAttachedFiles([]);
	}, [setAiMessages]);

	// ── File attachment management ───────────────────────────

	const attachFile = useCallback((file: File) => {
		if (!ALLOWED_TYPES.includes(file.type)) {
			setError("Only JPEG, PNG, WebP, and GIF images are supported.");
			return;
		}
		if (file.size > MAX_SIZE_MB * 1024 * 1024) {
			setError(`File too large (max ${MAX_SIZE_MB}MB).`);
			return;
		}
		setAttachedFiles((prev) => {
			if (prev.length >= MAX_IMAGES) {
				setError(`Max ${MAX_IMAGES} images per message.`);
				return prev;
			}
			return [...prev, file];
		});
		setError(null);
	}, []);

	/** Get or create a stable blob URL for a file (avoids creating new URLs on every render) */
	const getPreviewUrl = useCallback((file: File): string => {
		const existing = previewUrlsRef.current.get(file);
		if (existing) return existing;
		const url = URL.createObjectURL(file);
		previewUrlsRef.current.set(file, url);
		return url;
	}, []);

	const removeFile = useCallback((index: number) => {
		setAttachedFiles((prev) => {
			const removed = prev[index];
			if (removed) {
				const url = previewUrlsRef.current.get(removed);
				if (url) {
					URL.revokeObjectURL(url);
					previewUrlsRef.current.delete(removed);
				}
			}
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	/** Upload files to Supabase Storage, returns signed URLs */
	const uploadImages = useCallback(
		async (files: File[], convId: string): Promise<string[]> => {
			const urls: string[] = [];
			const {
				data: { user },
			} = await supabase.auth.getUser();
			const userId = user?.id ?? "anon";

			for (const file of files) {
				const ext = file.name.split(".").pop() || "jpg";
				const path = `${userId}/${convId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

				const uploadResponse = await supabase.storage
					.from("chat-images")
					.upload(path, file, { contentType: file.type });

				if (uploadResponse.error) {
					continue;
				}

				if (uploadResponse.data) {
					const signResponse = await supabase.storage
						.from("chat-images")
						.createSignedUrl(uploadResponse.data.path, 3600);

					if (!signResponse.error && signResponse.data?.signedUrl) {
						urls.push(signResponse.data.signedUrl);
					}
				}
			}
			return urls;
		},
		[supabase],
	);

	// ── Send message ─────────────────────────────────────────
	const sendMessage = useCallback(
		async (prefilledText?: string) => {
			const text = (prefilledText ?? input).trim();
			if (!text) return;

			const configError = getApiConfigurationError();
			if (configError) {
				setError(configError);
				return;
			}

			// Refresh auth token
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) {
				setError("Not authenticated. Please sign in.");
				return;
			}
			tokenRef.current = session.access_token;
			const originalInput = text;

			// Handle file uploads if any
			const filesToUpload = [...attachedFiles];
			// Revoke all preview blob URLs before clearing
			for (const [, url] of previewUrlsRef.current) {
				URL.revokeObjectURL(url);
			}
			previewUrlsRef.current.clear();
			setAttachedFiles([]);
			setInput("");
			setError(null);

			let imageUrls: string[] = [];
			if (filesToUpload.length > 0) {
				const tempConvId = conversationId || "pending";
				imageUrls = await uploadImages(filesToUpload, tempConvId);
			}

			// Send via AI SDK useChat — handles streaming automatically
			try {
				if (imageUrls.length > 0) {
					await Promise.resolve(
						aiSendMessage({
							text,
							files: imageUrls.map((url) => ({
								type: "file" as const,
								mediaType: "image/jpeg",
								url,
							})),
						}),
					);
				} else {
					await Promise.resolve(aiSendMessage({ text }));
				}

				// Refresh conversations list after backend has had time to save
				setTimeout(() => {
					void loadConversations();
				}, 2000);
			} catch (err) {
				if (!prefilledText) {
					setInput(originalInput);
				}
				setError(
					err instanceof Error
						? err.message
						: "Failed to reach AI Coach. You can keep going without chat.",
				);
			}
		},
		[
			input,
			attachedFiles,
			conversationId,
			supabase,
			aiSendMessage,
			uploadImages,
			loadConversations,
		],
	);

	// ── Stop streaming ───────────────────────────────────────
	const stopStreaming = useCallback(() => {
		stop();
	}, [stop]);

	return {
		// State
		messages,
		uiMessages: aiMessages,
		coachActivity,
		isConnecting,
		isTyping,
		isResponding,
		isLoading: false,
		input,
		setInput,
		conversationId,
		conversations,
		activeToolCalls: [] as string[],
		error,
		suggestedPrompts,
		attachedFiles,

		// Actions
		sendMessage,
		stopStreaming,
		loadConversation,
		newConversation,
		attachFile,
		removeFile,
		getPreviewUrl,
	};
}
