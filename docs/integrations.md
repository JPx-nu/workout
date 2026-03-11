# Fitness Integrations - Current Implementation

> Last Updated: 2026-03-11
> Code Root: `apps/api/src/services/integrations`
> Current consumers: web settings, mobile settings, webhook handlers

## Overview

The API uses a provider-agnostic integration layer for OAuth, webhook ingestion, token lifecycle management, and workout/health normalization.

Core modules:

- `types.ts` - provider contract and normalized data types
- `registry.ts` - provider registration and lookup
- `oauth.ts` - shared OAuth connect/callback/disconnect/sync logic
- `oauth-state.ts` - HMAC-signed OAuth state carrying `returnTo`
- `crypto.ts` - token encryption/decryption at rest
- `token-manager.ts` - token freshness/refresh pipeline
- `normalizer.ts` - dedup + inserts/upserts into `workouts`, `health_metrics`, and `daily_logs`
- `webhook-queue.ts` - durable PostgreSQL queue consumer

## Provider Status

| Provider | OAuth | Webhook Handling | Manual Sync | Notes |
|---|---|---|---|---|
| Strava | OAuth2 | Yes | Yes | Fully wired |
| Polar | OAuth2 | Yes (HMAC secret when configured) | Yes | Fully wired |
| Wahoo | OAuth2 | Yes (header token when configured) | Yes | Fully wired |
| Garmin | Partial | Route accepts payload, signature verification still pending approval | Connect/sync routes return pending-approval problem responses | Garmin stays visible as roadmap-only in settings |

## API Endpoints

### Auth-protected (`/api/integrations`)

Per-provider routes (`strava`, `polar`, `wahoo`, `garmin`):

- `GET /:provider/connect`
- `GET /:provider/callback`
- `POST /:provider/disconnect`
- `POST /:provider/sync`

Shared routes:

- `GET /status`
  - Returns `integrations[]` plus `webhookQueueSize`
  - Includes `available`, `availabilityReason`, `applyUrl`
  - Includes `actions.connect`, `actions.disconnect`, `actions.sync`
- `GET /sync-history`
  - Returns recent sync rows for the authenticated athlete
  - `limit` is clamped to `1-100`

### Public webhooks (`/webhooks`)

- `POST /strava`
- `GET /strava` (subscription challenge)
- `POST /polar`
- `POST /wahoo`
- `POST /garmin`

## Current Return Flow Behavior

- `returnTo` must be an allowlisted absolute `http(s)` URL.
- Web settings uses `/workout/dashboard/settings`.
- Mobile uses `APP_LINK_URL` and must also stay on allowlisted `http(s)` origins.
- Custom-scheme deep links are intentionally rejected in the current implementation.

## Security Model

- OAuth state is HMAC-signed and time-bound (10-minute TTL).
- `returnTo` is carried inside signed state and sanitized against `ALLOWED_OAUTH_RETURN_ORIGINS`.
- Tokens are encrypted before DB storage in `connected_accounts`.
- Sync calls use DB-backed rate limiting via `check_rate_limit`.
- Queue jobs are processed asynchronously from `webhook_queue` using SQL claim/complete/fail functions.
- Webhook verification is provider-specific:
  - Strava validates the subscription handshake and filters incoming events to supported activity-create payloads.
  - Polar uses HMAC verification when `POLAR_WEBHOOK_SECRET` is configured.
  - Wahoo verifies the configured header token when `WAHOO_WEBHOOK_TOKEN` is configured.
  - Garmin remains partial and currently accepts payloads while business approval and final verification are pending.

## Data Flow

1. Connect provider and exchange tokens.
2. Store encrypted tokens in `connected_accounts`.
3. Pull activities/health data during manual sync or webhook processing.
4. Normalize provider payloads into shared workout/health tables.
5. Enqueue webhook events into `webhook_queue` for async processing.
6. Track outcomes in `sync_history`.

## Required Environment Variables

Global integration:

- `INTEGRATION_ENCRYPTION_KEY`
- `API_URL`
- `WEB_URL`
- `ALLOWED_OAUTH_RETURN_ORIGINS`

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

## Notes

- `ProviderName` still includes `SUUNTO`, but no provider is registered for it.
- Web and mobile both rely on `/api/integrations/status` rather than local mock/provider lists.
