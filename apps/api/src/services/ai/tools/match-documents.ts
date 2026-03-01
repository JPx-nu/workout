// ============================================================
// Tool: Match Documents (Vector Search)
// Performs semantic search over the athlete's club knowledge base
// ============================================================

import { tool } from "@langchain/core/tools";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";

export function createMatchDocumentsTool(client: SupabaseClient, clubId: string) {
	return tool(
		async ({ query, threshold = 0.7, limit = 5 }) => {
			try {
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

				// Call the Supabase RPC match_documents
				const { data, error } = await client.rpc("match_documents", {
					query_embedding,
					match_threshold: threshold,
					match_count: limit,
					filter_club_id: clubId,
				});

				if (error) {
					return `Error searching documents: ${error.message}`;
				}

				if (!data || data.length === 0) {
					return "No highly relevant documents found for that query.";
				}

				return JSON.stringify(
					data.map((d: any) => ({
						title: d.title,
						content: d.content,
						similarity: d.similarity,
					})),
				);
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error searching documents: ${msg}. Please try again.`;
			}
		},
		{
			name: "match_documents",
			description:
				"Performs semantic search to find knowledge base documents (e.g. PDFs, articles) uploaded by the club. Useful for answering general fitness, nutrition, or club-specific policy questions.",
			schema: z.object({
				query: z.string().describe("The search query or question"),
				threshold: z
					.number()
					.optional()
					.describe("Minimum similarity threshold (0-1). Default 0.7"),
				limit: z.number().optional().describe("Maximum number of documents to return. Default 5"),
			}),
		},
	);
}
