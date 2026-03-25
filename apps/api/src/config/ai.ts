// ============================================================
// AI Agent Configuration
// Centralizes all AI-related settings for easy swapping
// ============================================================

import { createLogger } from "../lib/logger.js";

const log = createLogger({ module: "ai-config" });

export const AI_CONFIG = {
	/** Azure OpenAI deployment settings */
	azure: {
		/** Azure OpenAI resource endpoint, e.g. https://<resource>.openai.azure.com */
		endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
		/** Azure OpenAI instance name (e.g. "myinstance" from myinstance.openai.azure.com) */
		instanceName: process.env.AZURE_OPENAI_INSTANCE_NAME || "",
		/** Azure OpenAI API key */
		apiKey: process.env.AZURE_OPENAI_API_KEY || "",
		/** Deployment name for the chat model (e.g. "gpt-5-mini") */
		deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5-mini",
		/** Deployment name for the embeddings model. Leave empty to disable semantic memory recall. */
		embeddingsDeployment: process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT || "",
		/** API version — optional env override; defaults in code for smoother dev deploys */
		apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
	},

	/** Model behavior */
	model: {
		/** gpt-5-mini only supports temperature=1 (the default) */
		temperature: 1,
		maxCompletionTokens: 2048,
		/** Max messages to load from conversation history for context */
		historyLimit: 40,
	},

	/** Safety thresholds */
	safety: {
		/** Minimum confidence to skip disclaimer */
		confidenceThreshold: 0.7,
		/** Below this confidence, add a low-confidence disclaimer */
		lowConfidenceThreshold: 0.6,
		/** Max user message length (chars) */
		maxInputLength: 4000,
	},

	/** AI thresholds for memory and training analysis */
	thresholds: {
		/** Cosine similarity above which a memory is considered a duplicate */
		memorySimilarity: 0.88,
		/** ACWR zones: undertraining | optimal | caution | danger */
		acwr: { low: 0.8, optimal: 1.3, high: 1.5 },
	},

	/** Feature flags */
	features: {
		/** Enable SSE streaming responses */
		streaming: true,
		/** Keep self-review off by default until the streamed UX is robust enough to hide it fully */
		reflectionEnabled: false,
		/** Enable RAG document retrieval (future) */
		ragEnabled: false,
		/** Routine logging can proceed without an extra confirmation when intent is clear */
		confirmWrites: false,
		/** Enable vision/image analysis via GPT-5-mini */
		visionEnabled: true,
	},

	/** Agent execution guardrails to prevent runaway loops/costs */
	agent: {
		/** Max graph steps (LangGraph recursionLimit) per request */
		maxGraphSteps: 15,
		/** Overall timeout for a single request's agent execution */
		requestTimeoutMs: 90_000,
		/** Max cumulative tool calls per request */
		maxToolCalls: 10,
		/** Max reflection revisions when reflection is enabled */
		maxReflectionRevisions: 1,
	},

	/** File/image upload limits */
	uploads: {
		/** Maximum file size in megabytes */
		maxFileSizeMB: 10,
		/** Allowed MIME types for image uploads */
		allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as readonly string[],
		/** Max images per message */
		maxImagesPerMessage: 3,
		/** Supabase Storage bucket name */
		storageBucket: "chat-images",
	},
	/** Emoji labels for activity types (used in AI tool response strings) */
	activityEmoji: {
		SWIM: "\u{1F3CA}",
		BIKE: "\u{1F6B4}",
		RUN: "\u{1F3C3}",
		STRENGTH: "\u{1F3CB}\uFE0F",
		YOGA: "\u{1F9D8}",
		OTHER: "\u26A1",
	} as Record<string, string>,
} as const;

/** Validate that required env vars are set — warns at startup */
export function validateAIConfig(): { valid: boolean; missing: string[] } {
	const missing: string[] = [];

	if (!AI_CONFIG.azure.instanceName && !AI_CONFIG.azure.endpoint) {
		missing.push("AZURE_OPENAI_INSTANCE_NAME or AZURE_OPENAI_ENDPOINT");
	}
	if (!AI_CONFIG.azure.apiKey) missing.push("AZURE_OPENAI_API_KEY");
	if (!AI_CONFIG.azure.deploymentName) missing.push("AZURE_OPENAI_DEPLOYMENT");

	if (missing.length > 0) {
		log.warn(
			{ missing },
			"AI Agent: Missing env vars — agent will not function until these are set",
		);
	}

	return { valid: missing.length === 0, missing };
}

export function hasEmbeddingsDeployment(): boolean {
	return AI_CONFIG.azure.embeddingsDeployment.trim().length > 0;
}

/** Resolves Azure instance name from explicit env var or parses endpoint URL */
export function getAzureInstanceName(): string {
	if (AI_CONFIG.azure.instanceName) return AI_CONFIG.azure.instanceName;
	return AI_CONFIG.azure.endpoint.split(".")[0].replace("https://", "");
}
