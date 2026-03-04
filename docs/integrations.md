# Fitness Integrations — Current Implementation

> **Last Updated:** 2026-03-03  
> **Code Root:** `apps/api/src/services/integrations`

---

## Overview

The API uses a provider-agnostic integration layer for OAuth, webhook ingestion, token lifecycle management, and workout/health normalization.

Core modules:

- `types.ts` — provider contract and normalized data types
- `registry.ts` — provider registration and lookup
- `oauth.ts` — shared OAuth connect/callback/disconnect/sync logic
- `oauth-state.ts` — HMAC-signed OAuth state (CSRF protection)
- `crypto.ts` — token encryption/decryption at rest
- `token-manager.ts` — token freshness/refresh pipeline
- `normalizer.ts` — dedup + table inserts (`workouts`, `health_metrics`, `daily_logs`)
- `webhook-queue.ts` — durable PostgreSQL queue consumer

---

## Provider Status

| Provider | OAuth | Webhook Handling | Manual Sync | Notes |
|---|---|---|---|---|
| Strava | OAuth2 | Yes | Yes | Fully wired |
| Polar | OAuth2 | Yes (HMAC secret if configured) | Yes | Fully wired |
| Wahoo | OAuth2 | Yes (header token if configured) | Yes | Fully wired |
| Garmin | Partial (stubbed route behavior) | Accepts payload, verification TODO | Route exists, returns `503` pending approval | Business approval + OAuth 1.0a work pending |

---

## API Endpoints

### Auth-protected (`/api/integrations`)

Per-provider routes (`strava`, `polar`, `wahoo`, `garmin`):

- `GET /:provider/connect` (optional `returnTo` absolute URL; `http(s)` origin must be allowlisted)
- `GET /:provider/callback`
- `POST /:provider/disconnect`
- `POST /:provider/sync` (Garmin currently returns `503`)

Shared routes:

- `GET /status` — provider connection state + queue size + provider action metadata:
  - `available`, `availabilityReason`, `applyUrl`
  - `actions.connect`, `actions.disconnect`, `actions.sync`
- `GET /sync-history` — recent sync records (limit 1-100)

### Public webhooks (`/webhooks`)

- `POST /strava`
- `GET /strava` (subscription challenge)
- `POST /polar`
- `POST /wahoo`
- `POST /garmin`

---

## Security Model

- OAuth state is HMAC-signed and time-bound (10-minute TTL).
- OAuth `returnTo` is carried inside signed state and sanitized against allowlisted `http(s)` origins.
- Non-`http(s)` callback targets (custom schemes) are intentionally rejected in current implementation.
- Tokens are encrypted before DB storage (`connected_accounts`).
- Webhooks are verified per provider when secrets/tokens are configured.
- Sync calls use DB-backed rate limiting via `check_rate_limit`.
- Queue jobs are processed asynchronously from `webhook_queue` using SQL claim/complete/fail functions.

---

## Data Flow

1. Connect provider and exchange tokens.
2. Store encrypted tokens in `connected_accounts`.
3. Backfill/sync pulls provider activities.
4. Normalize to shared schema and upsert into app tables.
5. Webhook events enqueue jobs for async processing.
6. Sync outcomes are tracked in `sync_history`.

---

## Required Environment Variables

Global integration:

- `INTEGRATION_ENCRYPTION_KEY`
- `API_URL`
- `WEB_URL`
- `ALLOWED_OAUTH_RETURN_ORIGINS` (comma-separated `http(s)` origin allowlist; invalid entries are ignored)

Provider credentials:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_VERIFY_TOKEN`
- `POLAR_CLIENT_ID`
- `POLAR_CLIENT_SECRET`
- `POLAR_WEBHOOK_SECRET`
- `WAHOO_CLIENT_ID`
- `WAHOO_CLIENT_SECRET`
- `WAHOO_WEBHOOK_TOKEN`
- `GARMIN_CONSUMER_KEY`
- `GARMIN_CONSUMER_SECRET`

---

## Notes

- `ProviderName` type currently includes `SUUNTO`, but no provider implementation is registered in `registry.ts`.
- Garmin support is intentionally partial until business API access and OAuth 1.0a flow completion.
