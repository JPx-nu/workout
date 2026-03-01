// ============================================================
// Integration Library — Barrel Export
// Clean re-export of all public APIs.
// Import from `services/integrations/index.js` instead of
// individual files for convenience.
// ============================================================

export { decryptToken, encryptToken } from "./crypto.js";
export * from "./errors.js";
// HTTP utilities
export { fetchWithRetry } from "./http.js";
// Data normalization
export { normalizeAndStore } from "./normalizer.js";
// OAuth flow
export {
	buildAuthorizationUrl,
	disconnectProvider,
	handleOAuthCallback,
	verifyCallbackState,
} from "./oauth.js";
// Security
export { createOAuthState, verifyOAuthState } from "./oauth-state.js";
// Provider registry
export { getAllProviderNames, getAllProviders, getProvider } from "./registry.js";
// Token management
export {
	ensureFreshToken,
	getActiveConnection,
	getConnectedAccounts,
} from "./token-manager.js";
// Types
export * from "./types.js";

// Webhook processing
export { enqueueWebhook, stopPolling } from "./webhook-queue.js";
