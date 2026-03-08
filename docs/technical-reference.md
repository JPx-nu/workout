# Triathlon App Technical Reference

> Version: 0.5.0
> Last Updated: 2026-03-08
> Scope: implementation truth only, not roadmap intent

## 1. Repository Snapshot

Monorepo: `triathlon-app`

Workspaces:
- `apps/web`: Next.js 16 + React 19 web frontend
- `apps/api`: Hono API + LangGraph AI orchestration
- `packages/types`: shared types and Zod validation
- `packages/core`: shared mapping/date/stats logic
- `packages/api-client`: typed client scaffold
- `apps/mobile`: Flutter app outside pnpm workspaces

Tooling:
- `pnpm@10.29.2`
- `turbo`
- `biome`
- `vitest`
- Azure App Service deploy targets: `jpx-workout-web`, `jpx-workout-api`

## 2. Web Product Contract

Current web-v1 product is an athlete self-serve cockpit.

Supported web-v1 areas:
- Auth, session handling, and onboarding
- Dashboard with triathlon and strength views
- Workout history and filtering
- Training calendar backed by planned-workout API routes
- AI Coach with streaming chat, conversation history, and image attachments
- 2D body map backed by `daily_logs` and `injuries`
- Settings for profile edits, dashboard default view, onboarding redo, sign-out, and live integrations status/actions

Explicitly not part of supported web-v1:
- Team gamification, relays, or squad features
- Garmin end-user availability
- HealthKit or Health Connect in the web UI surface
- 3D body map as a supported feature
- Export data, delete account, or notification settings in the web UI

## 3. Web App Details

Base path:
- `/workout`

Main routes:
- `/login`
- `/dashboard`
- `/dashboard/onboarding`
- `/dashboard/workouts`
- `/dashboard/training`
- `/dashboard/coach`
- `/dashboard/body-map`
- `/dashboard/body-map-3d`
- `/dashboard/settings`
- `/privacy`
- `/terms`

Client data sources:
- `useProfile` -> Supabase `profiles` + `clubs`
- `useWorkouts` -> Supabase `workouts`
- `useTraining` -> Supabase `training_plans` + `events`
- `useHealth` -> Supabase `daily_logs` + `injuries`
- `useCoach` -> `/api/ai/stream`, `/api/ai/conversations`, Supabase `messages`, Supabase Storage `chat-images`
- `usePlannedWorkouts` -> `/api/planned-workouts`
- `useIntegrations` -> `/api/integrations/status`, `/:provider/connect`, `/:provider/disconnect`, `/:provider/sync`

Frontend behavior notes:
- AI chat uses Vercel AI SDK 6 `useChat` with `DefaultChatTransport`.
- Onboarding completion prefers `POST /api/onboarding` but falls back to direct Supabase profile updates so users can still exit onboarding if the API or coach transport fails.
- Settings uses the live integrations control plane rather than static connected-device placeholders.
- The 3D body map route remains accessible but is labeled experimental and still renders sample fatigue data.
- Web CSP `connect-src` is built from `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WEB_URL` at build time.

## 4. API Surface

Global behavior:
- OpenTelemetry bootstrap loads first.
- `secureHeaders` and CORS run on all routes.
- Body limits:
  - `/api/*`: 2 MB
  - `/api/ai/*`: 12 MB
- Supabase JWT verification uses JWKS via `jose`.
- AI routes use PostgreSQL-backed rate limiting.
- Problem responses use `application/problem+json`.

Public routes:
- `GET /health`
- `POST /webhooks/strava`
- `GET /webhooks/strava`
- `POST /webhooks/garmin`
- `POST /webhooks/polar`
- `POST /webhooks/wahoo`

Protected routes:
- `POST /api/ai/chat`
- `POST /api/ai/stream`
- `GET /api/ai/conversations`
- `POST /api/onboarding`
- `/api/health`
  - `POST /ingest`
- `/api/planned-workouts`
  - `GET /`
  - `GET /:id`
  - `POST /`
  - `PATCH /:id`
  - `PATCH /:id/complete`
  - `DELETE /:id`
- `/api/integrations`
  - `GET /status`
  - `GET /sync-history`
  - `GET /:provider/connect`
  - `GET /:provider/callback`
  - `POST /:provider/disconnect`
  - `POST /:provider/sync`
- MCP bridge:
  - `ALL /mcp`
- OpenAPI docs remain under JWT-protected `/api/*`
  - `GET /api/doc`
  - `GET /api/reference`

## 5. Integrations Status

Provider implementation:
- `STRAVA`: OAuth2, webhook, connect, disconnect, sync implemented
- `POLAR`: OAuth2, webhook verification, connect, disconnect, sync implemented
- `WAHOO`: OAuth2, webhook token verification, connect, disconnect, sync implemented
- `GARMIN`: roadmap-only for end users; connect and sync routes intentionally return pending-approval problem responses

Shared integration infrastructure:
- signed OAuth state
- encrypted token storage
- token refresh manager
- normalization pipeline
- durable webhook queue in PostgreSQL

Return flow behavior:
- `returnTo` supports allowlisted absolute `http(s)` URLs only
- settings connect flow returns to `/workout/dashboard/settings`
- Garmin stays visible as roadmap-only in settings

## 6. AI Coach Implementation

Agent architecture:
- LangGraph `StateGraph`
- loop: `llmCall -> tools -> llmCall`
- optional single reflection pass

Guardrails:
- max graph steps: `15`
- max tool calls: `10`
- max reflection revisions: `1`
- request timeout: `90s`

Memory behavior:
- loads pinned memories and same-day daily log
- uses embeddings for semantic recall
- performs background memory extraction after response save

## 7. Data and Database Notes

Current migrations cover:
- core schema and RLS
- planned workouts
- athlete memories and semantic search
- connected accounts and sync history
- webhook queue and distributed rate limiting
- mobile ingest idempotency indexes
- restrictive OAuth client access policies

Current Supabase edge-function note:
- `supabase/functions/vital-webhook` exists as an MVP scaffold and is not part of the main API route stack

## 8. Environment Variables

Web:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_ENABLE_DEMO`

API:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `WEB_URL`
- `API_URL`
- `APP_ENV`
- `FEATURE_AI_ENABLED`
- `FEATURE_INTEGRATIONS_ENABLED`
- `FEATURE_MCP_ENABLED`
- `ALLOWED_OAUTH_RETURN_ORIGINS`
- Azure OpenAI variables
- integration provider credentials
- `INTEGRATION_ENCRYPTION_KEY`

Mobile compile-time defines:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_URL`
- `APP_LINK_URL`

## 9. Current Product Decisions

- Web v1 is athlete-first and intentionally narrower than the roadmap.
- Settings is limited to live functionality only.
- 2D body map is the supported recovery view on web.
- 3D body map remains experimental until it uses live athlete data.
- Garmin remains unavailable until approval and OAuth 1.0a work are complete.
- Native app contract decisions stay deferred until the web-v1 surface is stable.
