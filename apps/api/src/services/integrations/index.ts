// ============================================================
// Integration Library — Barrel Export
// Clean re-export of all public APIs.
// Import from `services/integrations/index.js` instead of
// individual files for convenience.
// ============================================================

// Types
export * from "./types.js";
export * from "./errors.js";

// Provider registry
export { getProvider, getAllProviders, getAllProviderNames } from "./registry.js";

// OAuth flow
export {
    buildAuthorizationUrl,
    verifyCallbackState,
    handleOAuthCallback,
    disconnectProvider,
} from "./oauth.js";

// Token management
export {
    ensureFreshToken,
    getActiveConnection,
    getConnectedAccounts,
} from "./token-manager.js";

// Data normalization
export { normalizeAndStore } from "./normalizer.js";

// HTTP utilities
export { fetchWithRetry } from "./http.js";

// Security
export { createOAuthState, verifyOAuthState } from "./oauth-state.js";
export { encryptToken, decryptToken } from "./crypto.js";

// Webhook processing
export { enqueueWebhook, getQueueSize } from "./webhook-queue.js";
