// ============================================================
// Conversation Persistence Service
// CRUD for conversations & messages tables
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Conversation {
	id: string;
	athlete_id: string;
	club_id: string;
	title: string | null;
	created_at: string;
}

export interface ChatMessage {
	id: string;
	conversation_id: string;
	role: "user" | "assistant" | "system";
	content: string;
	metadata: Record<string, unknown> | null;
	created_at: string;
}

/**
 * Gets an existing conversation or creates a new one.
 */
export async function getOrCreateConversation(
	client: SupabaseClient,
	userId: string,
	clubId: string,
	conversationId?: string,
): Promise<Conversation> {
	// If an ID was provided, try to fetch it
	if (conversationId) {
		const { data, error } = await client
			.from("conversations")
			.select("*")
			.eq("id", conversationId)
			.eq("athlete_id", userId)
			.single();

		if (data && !error) return data;
		// If not found, fall through to create
	}

	// Create a new conversation
	const { data, error } = await client
		.from("conversations")
		.insert({ athlete_id: userId, club_id: clubId })
		.select()
		.single();

	if (error) throw new Error(`Failed to create conversation: ${error.message}`);
	return data;
}

/**
 * Loads message history for a conversation, ordered oldest-first.
 */
export async function loadHistory(
	client: SupabaseClient,
	conversationId: string,
	limit = 40,
): Promise<ChatMessage[]> {
	const { data, error } = await client
		.from("messages")
		.select("*")
		.eq("conversation_id", conversationId)
		.order("created_at", { ascending: true })
		.limit(limit);

	if (error)
		throw new Error(`Failed to load message history: ${error.message}`);
	return data ?? [];
}

/**
 * Persists one or more messages to the conversation.
 */
export async function saveMessages(
	client: SupabaseClient,
	conversationId: string,
	messages: Array<{
		role: "user" | "assistant" | "system";
		content: string;
		metadata?: Record<string, unknown>;
	}>,
): Promise<void> {
	const rows = messages.map((m) => ({
		conversation_id: conversationId,
		role: m.role,
		content: m.content,
		metadata: m.metadata ?? null,
	}));

	const { error } = await client.from("messages").insert(rows);
	if (error) throw new Error(`Failed to save messages: ${error.message}`);
}

/**
 * Generates a short title from the first user message (for sidebar display).
 */
export async function updateConversationTitle(
	client: SupabaseClient,
	conversationId: string,
	firstMessage: string,
): Promise<void> {
	const title =
		firstMessage.length > 60 ? firstMessage.slice(0, 57) + "..." : firstMessage;

	await client.from("conversations").update({ title }).eq("id", conversationId);
}

/**
 * Lists recent conversations for the sidebar.
 * Uses Supabase relation query to get message counts in a single round-trip.
 */
export async function listConversations(
	client: SupabaseClient,
	userId: string,
	limit = 20,
): Promise<
	Array<{
		id: string;
		title: string | null;
		created_at: string;
		message_count: number;
	}>
> {
	const { data, error } = await client
		.from("conversations")
		.select("id, title, created_at, messages(count)")
		.eq("athlete_id", userId)
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) throw new Error(`Failed to list conversations: ${error.message}`);

	return (data ?? []).map((conv) => ({
		id: conv.id,
		title: conv.title,
		created_at: conv.created_at,
		message_count: (conv.messages as Array<{ count: number }>)?.[0]?.count ?? 0,
	}));
}
