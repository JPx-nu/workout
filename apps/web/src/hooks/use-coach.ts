// ============================================================
// Hook: useCoach — AI Coach integration with Vercel AI SDK 6
// Replaces manual SSE parsing with useChat from @ai-sdk/react
// ============================================================

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { type Message, suggestedPrompts } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────
const MAX_IMAGES = 3;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * AI Coach hook with Vercel AI SDK 6 streaming.
 * Uses useChat for message state and AI SDK protocol streaming.
 * Keeps conversation management and file attachment logic.
 */
export function useCoach() {
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
	>([]);
	const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
	const previewUrlsRef = useRef<Map<File, string>>(new Map());
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
			api: `${API_URL}/api/ai/stream`,
			headers: () => ({
				Authorization: `Bearer ${tokenRef.current}`,
			}),
			body: () => ({ conversationId: conversationIdRef.current }),
			fetch: async (url, init) => {
				const response = await globalThis.fetch(url, init);
				// Capture conversationId from response header
				const convId = response.headers.get("X-Conversation-Id");
				if (convId) {
					setConversationId(convId);
				}
				return response;
			},
		}),
	});

	const isTyping = status === "streaming" || status === "submitted";

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
			})),
		[aiMessages],
	);

	// ── Load conversations list ──────────────────────────────
	const loadConversations = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) return;

			const res = await fetch(`${API_URL}/api/ai/conversations`, {
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
		loadConversations();
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
				setConversationId(convId);
			} catch (err) {
				setError("Failed to load conversation");
				console.error("Load conversation error:", err);
			}
		},
		[supabase, setAiMessages],
	);

	// ── Start a new conversation ─────────────────────────────
	const newConversation = useCallback(() => {
		setAiMessages([]);
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
					console.error("Upload error:", uploadResponse.error);
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
	const sendMessage = useCallback(async () => {
		const text = input.trim();
		if (!text) return;

		// Refresh auth token
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			setError("Not authenticated. Please sign in.");
			return;
		}
		tokenRef.current = session.access_token;

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
		if (imageUrls.length > 0) {
			aiSendMessage({
				text,
				files: imageUrls.map((url) => ({
					type: "file" as const,
					mediaType: "image/jpeg",
					url,
				})),
			});
		} else {
			aiSendMessage({ text });
		}

		// Refresh conversations list after backend has had time to save
		setTimeout(() => loadConversations(), 2000);
	}, [
		input,
		attachedFiles,
		conversationId,
		supabase,
		aiSendMessage,
		uploadImages,
		loadConversations,
	]);

	// ── Stop streaming ───────────────────────────────────────
	const stopStreaming = useCallback(() => {
		stop();
	}, [stop]);

	return {
		// State
		messages,
		isTyping,
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
