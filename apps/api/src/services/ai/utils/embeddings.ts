// ============================================================
// Shared Azure OpenAI Embeddings Factory
// Single source of truth for embedding model configuration.
// ============================================================

import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { AI_CONFIG } from "../../../config/ai.js";

/**
 * Creates a configured AzureOpenAIEmbeddings instance.
 * Centralizes the duplicated config from 6+ call sites.
 */
export function createEmbeddings(): AzureOpenAIEmbeddings {
	return new AzureOpenAIEmbeddings({
		azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
		azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", ""),
		azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
		azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
		maxRetries: 3,
		timeout: 10_000,
	});
}
