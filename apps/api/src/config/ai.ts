// ============================================================
// AI Agent Configuration
// Centralizes all AI-related settings for easy swapping
// ============================================================

export const AI_CONFIG = {
    /** Azure OpenAI deployment settings */
    azure: {
        /** Azure OpenAI resource endpoint, e.g. https://<resource>.openai.azure.com */
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        /** Azure OpenAI API key */
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        /** Deployment name for the chat model (e.g. "gpt-5-mini") */
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini',
        /** API version — preview (supports gpt-5-mini on AIServices) */
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
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
        /** Max user message length (chars) */
        maxInputLength: 4000,
    },

    /** Feature flags */
    features: {
        /** Enable SSE streaming responses */
        streaming: true,
        /** Enable RAG document retrieval (future) */
        ragEnabled: false,
        /** Require user confirmation before write operations */
        confirmWrites: true,
        /** Enable vision/image analysis via GPT-5-mini */
        visionEnabled: true,
    },

    /** File/image upload limits */
    uploads: {
        /** Maximum file size in megabytes */
        maxFileSizeMB: 10,
        /** Allowed MIME types for image uploads */
        allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as readonly string[],
        /** Max images per message */
        maxImagesPerMessage: 3,
        /** Supabase Storage bucket name */
        storageBucket: 'chat-images',
    },
} as const;

/** Validate that required env vars are set — warns at startup */
export function validateAIConfig(): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    if (!AI_CONFIG.azure.endpoint) missing.push('AZURE_OPENAI_ENDPOINT');
    if (!AI_CONFIG.azure.apiKey) missing.push('AZURE_OPENAI_API_KEY');

    if (missing.length > 0) {
        console.warn(
            `⚠️  AI Agent: Missing env vars: ${missing.join(', ')}. Agent will not function until these are set.`
        );
    }

    return { valid: missing.length === 0, missing };
}
