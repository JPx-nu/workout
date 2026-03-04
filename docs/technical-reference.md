# Triathlon App — Technical Reference (Current Implementation)

> **Version:** 0.4.0  
> **Last Updated:** 2026-03-03  
> **Scope:** Documents what is implemented in code right now (not roadmap intent).

---

## 1. Repository Snapshot

Monorepo: `triathlon-app` (`pnpm@10.29.2`, Turbo, Biome).

### Workspace packages

- `apps/web` — Next.js 16.1.6 + React 19.2.3 frontend
- `apps/api` — Hono 4 API with LangGraph AI orchestration
- `packages/types` — shared domain types + Zod v4 validation
- `packages/core` — shared mapping/date/stat/strength logic
- `packages/api-client` — typed client scaffold (currently not used by app consumers)

### Mobile app

- `apps/mobile` is a Flutter app (not a pnpm workspace package).
- `API_URL` compile-time default is `http://localhost:8787` (`lib/core/api/api_client.dart`).
- Settings "Connected Devices" consumes `GET /api/integrations/status` (live provider state + queue size).
- Body-map injury severity normalizes DB values `1-5` to UI fatigue levels `20-100`.

---

## 2. Runtime and Tooling

| Area | Current |
|---|---|
| Node runtime | Node 24 (CI + deploy workflows) |
| Package manager | pnpm |
| Task runner | turbo |
| Lint/format | Biome (`pnpm lint`, `pnpm format`) |
| Env consistency checks | Startup runtime validation (`apps/api/src/config/startup-env.ts`) + CI key-name check (`pnpm check:env-keys`) |
| API tests | Vitest |
| Web build | Next.js standalone output |
| Deployment | Azure App Service (`jpx-workout-web`, `jpx-workout-api`) |

---

## 3. Web App (apps/web)

### Routing

- Base path is `/workout` (`next.config.ts`).
- Main app routes under App Router:
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

### Data layer status

- Hooks are connected to real Supabase/API sources (no mock folder in `apps/web/src/lib`):
  - `useProfile` → `profiles` + `clubs`
  - `useWorkouts` → `workouts`
  - `useTraining` → `training_plans` + `events`
  - `useHealth` → `daily_logs` + `injuries`
  - `useCoach` → `/api/ai/stream` + `messages` + Supabase Storage (`chat-images`)
  - `usePlannedWorkouts` → `/api/planned-workouts`

### Key frontend implementation notes

- AI chat uses Vercel AI SDK 6 (`useChat`, `DefaultChatTransport`).
- Service worker configured with Serwist.
- React Compiler enabled (`reactCompiler: true`).
- CSP/security headers configured in `next.config.ts`.

---

## 4. API (apps/api)

### Global middleware/behavior

- OTel bootstrap imported first (`lib/telemetry.ts`).
- `secureHeaders` + CORS on all routes.
- Body limits:
  - `/api/*`: 2 MB
  - `/api/ai/*`: 12 MB
- JWT verification via Supabase JWKS (`jose`), then claim extraction (`app_metadata.club_id`, `app_metadata.role`).
- Tokens missing valid `app_metadata.club_id` or `app_metadata.role` are rejected with `401`.
- Rate limiting via PostgreSQL RPC (`check_rate_limit`) on `/api/ai/*` with Draft-7 headers.
- API now returns RFC 9457-style `application/problem+json` for global/auth/validation errors.

### Public routes

- `GET /health`
- `POST /webhooks/strava`
- `GET /webhooks/strava` (Strava subscription challenge)
- `POST /webhooks/garmin`
- `POST /webhooks/polar`
- `POST /webhooks/wahoo`

### Auth-protected routes

- `POST /api/ai/chat` (custom SSE events)
- `POST /api/ai/stream` (AI SDK stream protocol)
- `GET /api/ai/conversations`
- `POST /api/onboarding`
- `/api/health`:
  - `POST /ingest` (mobile HealthKit/Health Connect ingestion payload)
  - Ingestion writes are idempotent by `(athlete_id, source, external_id)` for `workouts` and `health_metrics`.
- `/api/planned-workouts`:
  - `GET /`
  - `GET /:id`
  - `POST /`
  - `PATCH /:id`
  - `PATCH /:id/complete`
  - `DELETE /:id`
- `/api/integrations`:
  - `GET /status`
  - `GET /sync-history`
  - `GET /:provider/connect` (supports optional `returnTo` absolute URL with allowlisted `http(s)` origin)
  - `GET /:provider/callback`
  - `POST /:provider/disconnect`
  - `POST /:provider/sync`
- MCP server:
  - `ALL /mcp`
- OpenAPI docs endpoints are under `/api/*` and therefore currently JWT-protected:
  - `GET /api/doc`
  - `GET /api/reference`

---

## 5. AI Coach Implementation

### Agent architecture

- LangGraph `StateGraph` with loop:
  - `llmCall` -> `tools` -> `llmCall`
  - optional `reflectNode` revision pass
- Guardrails:
  - max graph steps: `15`
  - max tool calls: `10`
  - max reflection revisions: `1`
  - request timeout: `90s`
  - repeated tool-signature detection to break loops

### Memory behavior

- Preloads pinned memories + same-day daily log.
- Semantic recall with embeddings (`searchMemoriesBySimilarity`).
- Post-response memory extraction runs in background and stores deduplicated memories.

### Safety behavior

- Blocks emergency/self-harm prompts with crisis response.
- Rejects empty or >4000-char input.
- Adds medical and/or low-confidence disclaimers on output.

### Tooling

21 tools are registered in `createAllTools()` and reused by both:
- the AI agent tool node
- the MCP bridge (`/mcp`)

Tool groups:
- profile/history/plan/report reads
- gamification tools
- write/update tools (workouts, soreness, injury, plan changes)
- planning/scheduling tools
- GraphRAG and memory tools
- analysis tools

---

## 6. Integrations Implementation

Implemented provider framework under `services/integrations`:

- OAuth flow with signed state (`oauth-state.ts`)
- encrypted token storage (`crypto.ts`)
- token refresh manager (`token-manager.ts`)
- normalization pipeline (`normalizer.ts`)
- durable PostgreSQL-backed webhook queue (`webhook-queue.ts`)

Provider status:

- `STRAVA`: OAuth2 + webhook + sync implemented
- `POLAR`: OAuth2 + webhook verification + sync implemented
- `WAHOO`: OAuth2 + webhook token verification + sync implemented
- `GARMIN`: partial/stub (business approval + OAuth 1.0a flow still pending)

---

## 7. Database and Supabase

Current migration set includes:

- Core schema, RLS, and performance tuning (`00001`–`00010`)
- planned workouts (`00011`, `00018`, `00019`)
- semantic search + athlete memory (`00012`, `00013`)
- connected accounts + sync history (`00014`, `00015`)
- webhook queue + distributed rate limit SQL functions (`00016`)
- cleanup cron schedules (`00017`)
- additional indexes (`00020`)
- mobile ingest idempotency indexes (`00021`)
- restrictive OAuth-client access policies (`20260221103127`)

Supabase Edge Function status:

- `supabase/functions/vital-webhook` exists as an MVP scaffold (not part of core API route stack).

---

## 8. Environment Variables (Implementation-Critical)

### Web (Next.js)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WEB_URL` (used in login/callback flows)
- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_ENABLE_DEMO`

### API (Hono)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `WEB_URL`
- `API_URL`
- Feature flags:
  - `APP_ENV` (`local` | `demo` | `prod`)
  - `FEATURE_AI_ENABLED`
  - `FEATURE_INTEGRATIONS_ENABLED`
  - `FEATURE_MCP_ENABLED`
- OAuth return allowlist:
  - `ALLOWED_OAUTH_RETURN_ORIGINS` (comma-separated `http(s)` origin allowlist for `returnTo`)
- Azure OpenAI vars:
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT`
  - `AZURE_OPENAI_API_VERSION`
  - `AZURE_OPENAI_INSTANCE_NAME` or `AZURE_OPENAI_ENDPOINT`
- Integration vars:
  - `INTEGRATION_ENCRYPTION_KEY`
  - `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`
  - `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, `POLAR_WEBHOOK_SECRET`
  - `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET`, `WAHOO_WEBHOOK_TOKEN`
  - `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`

### Mobile (Flutter compile-time defines)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_URL` (optional; defaults to `http://localhost:8787`)
- `APP_LINK_URL` (optional; OAuth return target used by mobile connect flow, must resolve to an allowlisted `http(s)` URL)

---

## 9. Confirmed Decisions (2026-03-03)

- Canonical web Supabase key name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- API docs endpoints (`/api/doc`, `/api/reference`) remain protected by JWT middleware for now.
- Garmin integration remains documented as partial/stub until approval/implementation is completed.
- OAuth `returnTo` currently supports only allowlisted `http(s)` callback targets (no custom scheme deep links yet).
