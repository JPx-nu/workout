// ============================================================
// Hook: useCoach — AI Coach integration with SSE streaming
// Replaces mock data with real API calls
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type Message,
	suggestedPrompts,
} from "@/lib/mock/coach";
import { createClient } from "@/lib/supabase/client";

// API base URL — the Hono API server
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

// ── Constants ────────────────────────────────────────────────
const MAX_IMAGES = 3;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * AI Coach hook with real API integration.
 * Streams responses via SSE and persists conversations.
 */
export function useCoach() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isTyping, setIsTyping] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [input, setInput] = useState("");
	const [conversationId, setConversationId] = useState<string | undefined>(
		undefined,
	);
	const [conversations, setConversations] = useState<
		Array<{
			id: string;
			title: string | null;
			created_at: string;
			message_count: number;
		}>
	>([]);
	const [activeToolCalls, setActiveToolCalls] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
	const abortRef = useRef<AbortController | null>(null);
	const supabase = useMemo(() => createClient(), []);

	// ── Load conversations list ──────────────────────────────
	const loadConversations = useCallback(async () => {
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session?.access_token) return;

			const res = await fetch(`${API_BASE}/api/ai/conversations`, {
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
			setIsLoading(true);
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

				const msgs: Message[] = (data ?? []).map(
					(m: {
						id: string;
						role: string;
						content: string;
						created_at: string;
						metadata: Record<string, unknown> | null;
					}) => ({
						id: m.id,
						role: m.role as "user" | "assistant" | "system",
						content: m.content,
						createdAt: m.created_at,
						metadata: m.metadata as Message["metadata"],
					}),
				);

				setMessages(msgs);
				setConversationId(convId);
			} catch (err) {
				setError("Failed to load conversation");
				console.error("Load conversation error:", err);
			} finally {
				setIsLoading(false);
			}
		},
		[supabase],
	);

	// ── Start a new conversation ─────────────────────────────
	const newConversation = useCallback(() => {
		setMessages([]);
		setConversationId(undefined);
		setError(null);
		setActiveToolCalls([]);
		setAttachedFiles([]);
	}, []);

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

	const removeFile = useCallback((index: number) => {
		setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
	}, []);

	/** Upload files to Supabase Storage, returns signed URLs (bucket is private) */
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
						.createSignedUrl(uploadResponse.data.path, 3600); // 1-hour TTL

					if (!signResponse.error && signResponse.data?.signedUrl) {
						urls.push(signResponse.data.signedUrl);
					}
				}
			}
			return urls;
		},
		[supabase],
	);

	// ── Send message with SSE streaming ──────────────────────
	const sendMessage = useCallback(async () => {
		const text = input.trim();
		if (!text || isTyping) return;

		const filesToUpload = [...attachedFiles];
		setAttachedFiles([]);
		setError(null);

		// Add user message optimistically (with image previews)
		const previewUrls = filesToUpload.map((f) => URL.createObjectURL(f));
		const userMsg: Message = {
			id: `msg-${Date.now()}`,
			role: "user",
			content: text,
			createdAt: new Date().toISOString(),
			metadata: previewUrls.length > 0 ? { imageUrls: previewUrls } : undefined,
		};
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsTyping(true);
		setActiveToolCalls([]);

		// Get auth token
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			setError("Not authenticated. Please sign in.");
			setIsTyping(false);
			return;
		}

		// Upload images to Supabase Storage if any
		let imageUrls: string[] = [];
		if (filesToUpload.length > 0) {
			const tempConvId = conversationId || "pending";
			imageUrls = await uploadImages(filesToUpload, tempConvId);
			// Update user message with final URLs (replace blob: previews)
			if (imageUrls.length > 0) {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === userMsg.id
							? { ...m, metadata: { ...m.metadata, imageUrls } }
							: m,
					),
				);
			}
		}

		// Abort any previous streaming request
		if (abortRef.current) {
			abortRef.current.abort();
		}
		abortRef.current = new AbortController();

		try {
			const res = await fetch(`${API_BASE}/api/ai/chat`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({
					message: text,
					conversationId,
					...(imageUrls.length > 0 && { imageUrls }),
				}),
				signal: abortRef.current.signal,
			});

			// Handle non-SSE responses (safety blocks, config errors)
			const contentType = res.headers.get("content-type") ?? "";
			if (contentType.includes("application/json")) {
				const data = await res.json();
				const aiMsg: Message = {
					id: `msg-${Date.now() + 1}`,
					role: "assistant",
					content: data.content || data.error || "No response",
					createdAt: new Date().toISOString(),
					metadata: data.metadata,
				};
				setMessages((prev) => [...prev, aiMsg]);
				if (data.conversationId) setConversationId(data.conversationId);
				setIsTyping(false);
				return;
			}

			// Process SSE stream
			const reader = res.body?.getReader();
			const decoder = new TextDecoder();
			let assistantContent = "";
			const assistantMsgId = `msg-${Date.now() + 1}`;

			// Add empty assistant message that we'll fill in
			setMessages((prev) => [
				...prev,
				{
					id: assistantMsgId,
					role: "assistant",
					content: "",
					createdAt: new Date().toISOString(),
				},
			]);

			if (!reader) {
				setError("Failed to read response stream");
				setIsTyping(false);
				return;
			}

			let buffer = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Parse SSE events from buffer
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // Keep incomplete line in buffer

				let eventType = "";
				for (const line of lines) {
					if (line.startsWith("event: ")) {
						eventType = line.slice(7).trim();
					} else if (line.startsWith("data: ")) {
						const dataStr = line.slice(6);
						try {
							const data = JSON.parse(dataStr);

							switch (eventType) {
								case "metadata":
									if (data.conversationId) {
										setConversationId(data.conversationId);
									}
									break;

								case "delta":
									assistantContent += data.content || "";
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMsgId
												? { ...m, content: assistantContent }
												: m,
										),
									);
									break;

								case "tool":
									setActiveToolCalls((prev) => [...prev, data.tool]);
									break;

								case "clear":
									assistantContent = "";
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMsgId
												? { ...m, content: assistantContent }
												: m,
										),
									);
									break;

								case "correction":
									assistantContent = data.content;
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMsgId
												? { ...m, content: assistantContent }
												: m,
										),
									);
									break;

								case "error":
									setError(data.message);
									assistantContent = data.message;
									setMessages((prev) =>
										prev.map((m) =>
											m.id === assistantMsgId
												? { ...m, content: assistantContent }
												: m,
										),
									);
									break;

								case "done":
									// Refresh conversations list
									loadConversations();
									break;
							}
						} catch {
							// Skip malformed JSON
						}
					}
				}
			}
		} catch (err) {
			if ((err as Error).name === "AbortError") return;

			setError("Failed to connect to AI Coach. Please try again.");
			console.error("Chat error:", err);
		} finally {
			setIsTyping(false);
			abortRef.current = null;
		}
	}, [
		input,
		isTyping,
		conversationId,
		supabase,
		loadConversations,
		attachedFiles,
		uploadImages,
	]);

	// ── Stop streaming ───────────────────────────────────────
	const stopStreaming = useCallback(() => {
		if (abortRef.current) {
			abortRef.current.abort();
			abortRef.current = null;
			setIsTyping(false);
		}
	}, []);

	return {
		// State
		messages,
		isTyping,
		isLoading,
		input,
		setInput,
		conversationId,
		conversations,
		activeToolCalls,
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
	};
}
