// ============================================================
// Memory Extractor — Automatic Background Memory Extraction
// Analyzes conversation turns and extracts noteworthy facts,
// preferences, goals, and patterns into athlete_memories.
// Runs fire-and-forget after each AI response.
// ============================================================

import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_CONFIG } from "../../config/ai.js";
import { getRecentMemories, insertMemory } from "./supabase.js";

/** Shape of a candidate memory from the extraction LLM */
interface CandidateMemory {
    category:
    | "preference"
    | "goal"
    | "constraint"
    | "pattern"
    | "medical_note"
    | "other";
    content: string;
    importance: number;
}

const EXTRACTION_PROMPT = `You are a memory extraction system for an AI fitness coach.
Analyze the following conversation snippet and extract any NEW facts worth remembering about the athlete.

Focus on:
- **Preferences**: communication style, workout timing, equipment, exercise likes/dislikes
- **Goals**: races, PRs, body composition, skill targets
- **Constraints**: injuries, schedule limitations, equipment access
- **Patterns**: typical routines, habits, training frequency
- **Medical notes**: chronic conditions, medications, allergies

Rules:
- Only extract genuinely new, useful facts — not things already in existing memories
- Each memory should be a standalone sentence (e.g., "Athlete prefers evening workouts")
- Set importance 1-5: 1=trivial preference, 3=useful context, 5=critical constraint/medical
- Return an empty array [] if nothing new is worth remembering
- Maximum 3 extractions per turn — quality over quantity
- Do NOT extract transient information (e.g., "just did a 5k today" — that's workout data, not a memory)

Respond ONLY with a JSON array. No markdown, no explanation.`;

/**
 * Extracts memories from a conversation turn and saves them.
 * Designed to run fire-and-forget (no await needed by caller).
 */
export async function extractMemories(
    client: SupabaseClient,
    userId: string,
    userMessage: string,
    assistantResponse: string,
): Promise<void> {
    try {
        // Load existing memories for deduplication context
        const existingMemories = await getRecentMemories(client, userId, 20);
        const existingContext =
            existingMemories.length > 0
                ? `\n\nExisting memories (DO NOT re-extract these):\n${existingMemories.map((m) => `- ${m.content}`).join("\n")}`
                : "";

        // Use a separate, cheap LLM call for extraction
        const llm = new AzureChatOpenAI({
            azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
            azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
            azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
            azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
            temperature: 0, // Deterministic extraction
            modelKwargs: { max_completion_tokens: 512 },
        });

        const response = await llm.invoke([
            { type: "system", content: EXTRACTION_PROMPT + existingContext },
            {
                type: "human",
                content: `User: ${userMessage}\n\nAssistant: ${assistantResponse}`,
            },
        ]);

        const content =
            typeof response.content === "string" ? response.content.trim() : "";

        if (!content || content === "[]") return;

        // Parse the JSON array
        let candidates: CandidateMemory[];
        try {
            candidates = JSON.parse(content);
            if (!Array.isArray(candidates)) return;
        } catch {
            console.warn("Memory extractor: failed to parse JSON:", content);
            return;
        }

        // Validate and limit
        candidates = candidates
            .filter(
                (c) =>
                    c.content &&
                    typeof c.content === "string" &&
                    c.category &&
                    typeof c.importance === "number",
            )
            .slice(0, 3);

        if (candidates.length === 0) return;

        // Deduplicate via embeddings — skip if too similar to existing memories
        const embeddingsModel = new AzureOpenAIEmbeddings({
            azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
            azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint
                .split(".")[0]
                .replace("https://", ""),
            azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
            azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
        });

        // Get embeddings for existing memories that have them
        const existingEmbeddings = existingMemories
            .filter((m) => m.embedding && m.embedding.length > 0)
            .map((m) => ({ content: m.content, embedding: m.embedding! }));

        for (const candidate of candidates) {
            try {
                const candidateEmbedding = await embeddingsModel.embedQuery(
                    candidate.content,
                );

                // Check cosine similarity against existing memories
                const isDuplicate = existingEmbeddings.some((existing) => {
                    const similarity = cosineSimilarity(
                        candidateEmbedding,
                        existing.embedding,
                    );
                    return similarity > 0.88; // High threshold — only skip near-duplicates
                });

                if (isDuplicate) {
                    continue;
                }

                // Save the new memory
                await insertMemory(client, {
                    athlete_id: userId,
                    category: candidate.category,
                    content: candidate.content,
                    importance: Math.min(5, Math.max(1, Math.round(candidate.importance))),
                    embedding: candidateEmbedding,
                });

                console.log(
                    `🧠 Memory extracted: [${candidate.category}] ${candidate.content}`,
                );
            } catch (err) {
                console.warn("Memory extractor: failed to process candidate:", err);
            }
        }
    } catch (err) {
        // Never throw — this is fire-and-forget
        console.error("Memory extractor error:", err);
    }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}
