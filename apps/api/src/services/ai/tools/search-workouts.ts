// ============================================================
// Tool: Search Workouts (Semantic Search)
// Finds past workouts matching natural language descriptions
// ============================================================

import { tool } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";

export function createSearchWorkoutsTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async ({ query, threshold = 0.6, limit = 5 }) => {
			// Initialize embeddings
			const embeddings = new AzureOpenAIEmbeddings({
				azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
				azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint
					.split(".")[0]
					.replace("https://", ""),
				azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
				azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
			});

			// Generate vector for the query
			const query_embedding = await embeddings.embedQuery(query);

			// Call the Supabase RPC match_workouts
			const { data, error } = await client.rpc("match_workouts", {
				p_athlete_id: userId,
				query_embedding,
				match_threshold: threshold,
				match_count: limit,
			});

			if (error) {
				return `Error searching workouts: ${error.message}`;
			}

			if (!data || data.length === 0) {
				return "No matching workouts found for that query.";
			}

			return JSON.stringify(
				data.map((w: any) => ({
					id: w.id,
					activityType: w.activity_type,
					date: w.started_at,
					distanceMeters: w.distance_m,
					durationSeconds: w.duration_s,
					notes: w.notes,
					similarity: w.similarity,
				})),
			);
		},
		{
			name: "search_workouts",
			description:
				'Performs a natural language semantic search over the athlete\'s past workouts based on their notes. Use this when the user asks vague questions like "find the run where it was raining" or "when did I last do 400m repeats?".',
			schema: z.object({
				query: z
					.string()
					.describe(
						'The natural language search query (e.g. "rainy run", "felt great")',
					),
				threshold: z
					.number()
					.optional()
					.describe("Minimum similarity threshold (0-1). Default 0.6"),
				limit: z
					.number()
					.optional()
					.describe("Maximum number of workouts to return. Default 5"),
			}),
		},
	);
}
