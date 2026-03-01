// ============================================================
// Tool: Save Memory (Long-term Context)
// Saves a fact, preference, or goal to the athlete's memory
// ============================================================

import { tool } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";
import { createLogger } from "../../../lib/logger.js";
import { insertMemory } from "../supabase.js";

const log = createLogger({ module: "tool-save-memory" });

export function createSaveMemoryTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ category, content, importance = 3 }) => {
			try {
				// Generate embedding for natural language search scaling later
				let embedding: number[] | undefined;
				try {
					const embeddingsModel = new AzureOpenAIEmbeddings({
						azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
						azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint
							.split(".")[0]
							.replace("https://", ""),
						azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
						azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
					});
					embedding = await embeddingsModel.embedQuery(content);
				} catch (err) {
					log.error({ err }, "Failed to generate embedding for athlete memory");
				}

				const memory = await insertMemory(client, {
					athlete_id: userId,
					category,
					content,
					importance,
					embedding,
				});

				return `Memory saved successfully (ID: ${memory.id}). The agent will now remember this fact in future conversations.`;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error saving memory: ${msg}. Please try again.`;
			}
		},
		{
			name: "save_memory",
			description:
				'Saves a long-term memory about the athlete. Use this proactively when the athlete mentions a preference, a continuous goal, a constraint (e.g., "I hate mornings", "I am training for an Ironman", "My knee always hurts on long runs").',
			schema: z.object({
				category: z
					.enum(["preference", "goal", "constraint", "pattern", "medical_note", "other"])
					.describe("The category of the memory"),
				content: z
					.string()
					.describe('The standalone fact to remember (e.g. "Athlete prefers evening workouts")'),
				importance: z
					.number()
					.min(1)
					.max(5)
					.optional()
					.describe("Importance of the memory from 1 (trivial) to 5 (critical)"),
			}),
		},
	);
}
