# Triathlon AI SaaS — Technical Reference & Implementation Status

> **Version:** 0.3.0 · **Last Updated:** 2026-02-26  
> **Source of Truth:** Cross-references [Triathlon AI SaaS Plan Review.md](../Triathlon%20AI%20SaaS%20Plan%20Review.md)

---

## 1. Project Overview

**Goal:** Build a club-agnostic AI coaching platform for triathletes using Agentic GraphRAG, native health data integration, and immersive Liquid Glass UI.

**Architecture:** Turborepo monorepo with two apps and two shared packages, deployed to Azure App Service, backed by Supabase (Postgres + Auth + Storage + Realtime). Native mobile via Capacitor.js WebView wrapping the hosted web app.

---

## 2. Repository Structure

```
triathlon-app/                  ← Root (pnpm workspace + Turborepo)
├── apps/
│   ├── web/                    ← Next.js 16 frontend (React 19)
│   │   ├── src/
│   │   │   ├── app/            ← App Router pages
│   │   │   │   ├── dashboard/  ← Main dashboard layout + pages
│   │   │   │   │   ├── body-map/        ← 2D SVG body map
│   │   │   │   │   ├── body-map-3d/     ← 3D R3F body map
│   │   │   │   │   ├── coach/           ← AI Coach chat UI
│   │   │   │   │   ├── settings/        ← User settings
│   │   │   │   │   ├── training/        ← Training plan view
│   │   │   │   │   └── workouts/        ← Workouts list
│   │   │   ├── components/     ← Reusable UI components
│   │   │   │   ├── body-map/   ← SVG muscle paths + detail panel
│   │   │   │   ├── body-map-3d/← React Three Fiber 3D viewer
│   │   │   │   ├── theme-provider.tsx
│   │   │   │   └── theme-toggle.tsx
│   │   │   ├── hooks/          ← Data hooks (mock-backed)
│   │   │   ├── lib/
│   │   │   │   ├── mock/       ← Mock data for all entities
│   │   │   │   └── supabase/   ← Client & server Supabase helpers
│   │   │   └── middleware.ts   ← Next.js middleware
│   │   ├── public/             ← Static assets (models, icons)
│   │   └── next.config.ts      ← reactCompiler, standalone, security headers
│   └── api/                    ← Hono backend (Node.js)
│       └── src/
│           ├── server.ts       ← Entry point (Hono + middleware)
│           ├── middleware/
│           │   ├── auth.ts     ← JWT auth (hono/jwt) + claims extraction
│           │   └── rate-limit.ts ← Sliding-window rate limiter
│           ├── config/
│           │   └── integrations.ts ← Provider env-var config
│           ├── routes/
│           │   ├── ai/chat.ts          ← AI Coach endpoint (safety-guarded)
│           │   ├── integrations/       ← OAuth routes per provider
│           │   │   ├── index.ts        ← Status + sync-history endpoints
│           │   │   ├── strava.ts       ← Strava OAuth + manual sync
│           │   │   ├── garmin.ts       ← Garmin (pending API approval)
│           │   │   ├── polar.ts        ← Polar OAuth + manual sync
│           │   │   └── wahoo.ts        ← Wahoo OAuth + manual sync
│           │   └── webhooks/index.ts   ← Provider-agnostic webhook dispatcher
│           ├── services/
│           │   ├── ai/         ← LangGraph agent
│           │   │   ├── safety.ts  ← AI safety guard
│           │   │   ├── nodes/     ← Agent nodes directory
│           │   │   └── tools/     ← Agent tools directory
│           │   ├── integrations/  ← Fitness platform integration library
│           │   │   ├── types.ts        ← IntegrationProvider interface
│           │   │   ├── registry.ts     ← Provider map
│           │   │   ├── oauth.ts        ← Generic OAuth factory
│           │   │   ├── oauth-state.ts  ← HMAC-signed CSRF protection
│           │   │   ├── crypto.ts       ← AES-256-GCM token encryption
│           │   │   ├── normalizer.ts   ← Dedup + schema mapping
│           │   │   ├── token-manager.ts← Auto-refresh + decrypt
│           │   │   ├── webhook-queue.ts← Async job queue
│           │   │   ├── http.ts        ← Retry with backoff
│           │   │   ├── errors.ts      ← Typed error hierarchy
│           │   │   ├── index.ts       ← Barrel export
│           │   │   └── providers/     ← Per-platform implementations
│           │   ├── ingestion/  ← Document ingestion (scaffolded)
│           │   └── normalization/ ← Workout data normalization (scaffolded)
│           └── __tests__/
│               └── health.test.ts  ← Health check test
├── packages/
│   ├── types/                  ← @triathlon/types — Shared TS types
│   │   └── src/
│   │       ├── index.ts        ← All domain types & interfaces
│   │       └── validation.ts   ← Zod 4 runtime validation schemas
│   └── config/                 ← Shared config (scaffolded)
├── supabase/
│   ├── config.toml
│   ├── functions/              ← Edge Functions (empty)
│   └── migrations/             ← 8+ migration files
│       ├── 00001_enable_extensions.sql
│       ├── 00002_create_core_tables.sql
│       ├── 00003_create_rag_and_kg_tables.sql
│       ├── 00004_create_gamification_and_chat.sql
│       ├── 00005_create_rls_and_auth_hook.sql
│       ├── 00006_optimize_rls_performance.sql
│       ├── 00014_add_connected_accounts.sql  ← OAuth token storage
│       └── 00015_add_sync_history.sql         ← Sync audit log
├── docs/
│   ├── technical-reference.md  ← This document
│   └── design-system.md        ← Liquid Glass design system reference
├── scripts/
│   └── security-audit.ts       ← RLS red-team test (stub)
├── .gemini/
│   └── rules.md                ← AI agent project rules
├── .agent/workflows/
│   ├── dev.md                  ← Development workflow
│   └── deploy.md               ← Azure deployment workflow
├── .github/workflows/
│   ├── ci.yml                  ← CI pipeline (lint → test → build → audit)
│   └── deploy.yml              ← Deploy to Azure (web + api)
├── .env.example                ← Environment variables template
├── turbo.json                  ← Turborepo task configuration
├── pnpm-workspace.yaml         ← Workspace definition
└── .npmrc                      ← node-linker=hoisted
```

---

## 3. Technology Stack

| Layer | Target | Current Implementation | Status |
|---|---|---|---|
| **Runtime** | Node.js 24 LTS | Node.js 24 (CI + deploy) | ✅ Done |
| **Frontend Framework** | React 19 + React Compiler | Next.js 16.1.6 + React 19.2.3 + `babel-plugin-react-compiler` | ✅ Done |
| **CSS** | Tailwind CSS v4 + Liquid Glass | Tailwind v4 + `@tailwindcss/postcss` + custom Liquid Glass CSS variables | ✅ Done |
| **3D Visualization** | React Three Fiber | `@react-three/fiber` 9.5 + `@react-three/drei` 10.7 + `three` 0.182 | ✅ Done |
| **Backend Framework** | Hono (Node.js) | Hono 4 + `@hono/node-server` + JWT auth + rate limiter | ✅ Done |
| **AI Orchestration** | LangGraph 1.1 | `@langchain/langgraph` 1.1.4 + `@langchain/openai` 0.4 + `@langchain/core` 0.3 | ✅ Working (SSE streaming) |
| **Validation** | Zod 4 | Zod 4 — `z.interface()`, `z.uuid()`, `z.url()`, `z.iso.datetime()` | ✅ Done |
| **Database** | Supabase (Postgres + pgvector) | Supabase JS v2, pgvector enabled, full schema, optimized RLS | ✅ Schema complete |
| **Auth** | Supabase Auth + Custom Claims JWT | Custom claims auth hook + JWT middleware on API | ✅ Done |
| **Mobile** | Capacitor.js (HealthKit/Health Connect) | CSP Capacitor-ready, native compat rules enforced | ⚠️ Init pending |
| **Hosting** | Azure App Service | `jpx-workout-web` + `jpx-workout-api` | ✅ Pipeline done |
| **CI/CD** | GitHub Actions | CI (`ci.yml`) + Deploy (`deploy.yml`) | ✅ Done |
| **Build System** | Turborepo + pnpm | Turborepo 2 + pnpm 10 | ✅ Done |
| **Fitness Integrations** | Strava, Garmin, Polar, Wahoo | Provider-agnostic library with encrypted tokens, async webhooks | ✅ Library complete |

---

## 4. Database Schema

All 6 migrations cover the complete schema.

### Migration 1: Extensions

- `uuid-ossp` — UUID generation
- `vector` (pgvector) — Vector embeddings for RAG
- `pg_trgm` — Trigram fuzzy text search

### Migration 2: Core Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `clubs` | Multi-tenant root | `id`, `name`, `slug`, `settings` |
| `profiles` | Extends `auth.users` | `club_id`, `role` (athlete/coach/admin/owner), `display_name`, `timezone` |
| `events` | Races | `club_id`, `distance_type` (SPRINT..IRONMAN), `event_date` |
| `workouts` | Normalized workout data | `athlete_id`, `activity_type`, `source`, `duration_s`, `distance_m`, `avg_hr`, `tss`, `raw_data` |
| `daily_logs` | Daily check-ins | `sleep_hours`, `sleep_quality`, `rpe`, `mood`, `hrv`, `resting_hr`, `weight_kg` |
| `injuries` | Injury tracking | `body_part`, `severity` (1-5), `reported_at`, `resolved_at` |
| `training_plans` | AI-generated plans | `event_id`, `status`, `plan_data` (jsonb) |
| `health_metrics` | HealthKit/Health Connect data | `metric_type` (HRV/SLEEP/SPO2/etc.), `value`, `source` |

**Triggers:** `handle_new_user()` auto-creates a profile on signup.

### Migration 3: RAG & Knowledge Graph

| Table | Purpose |
|---|---|
| `documents` | Club PDF/markdown uploads with processing status |
| `document_chunks` | Text chunks with `vector(2000)` embeddings + HNSW index |
| `kg_nodes` | Knowledge graph entities (ATHLETE, WORKOUT, INJURY, EQUIPMENT, CLUB_RULE, etc.) |
| `kg_edges` | Relationships (PERFORMED, CAUSED, RECOMMENDS, RESTRICTS, HAS_INJURY, etc.) |

**Functions:**

- `match_documents(query_embedding, threshold, count, club_id)` — Vector similarity search
- `traverse_athlete_graph(athlete_id, depth, relationship_types)` — Recursive CTE graph traversal

### Migration 4: Gamification & Chat

| Table | Purpose |
|---|---|
| `squads` | Team groupings within a club |
| `squad_members` | Athlete ↔ Squad mapping |
| `relay_events` | Async virtual relays with distance goals |
| `baton_passes` | Individual leg tracking |
| `conversations` | AI coach conversation threads |
| `messages` | Individual messages with role + metadata |

### Migration 5: RLS & Auth Hook

- **Custom Claims Auth Hook** (`custom_access_token_hook`) — Injects `club_id` and `role` into JWT `app_metadata` on login
- **Helper** (`requesting_club_id()`) — Extracts `club_id` from JWT for RLS policies
- **RLS Policies** — Comprehensive policies on ALL 15 tables using `club_id = requesting_club_id()` pattern

### Migration 6: RLS Performance Optimization

- All `auth.uid()` and `requesting_club_id()` calls wrapped in `(select ...)` subqueries
- Postgres evaluates wrapped functions **once per query** instead of once per row
- Significant performance improvement on tables with many rows

---

## 5. Frontend — Current State

### Stack

- **Framework:** Next.js 16.1.6 (App Router, `output: 'standalone'`)
- **React:** 19.2.3 with React Compiler (`reactCompiler: true`)
- **CSS:** Tailwind v4 with custom Liquid Glass design system via CSS variables
- **Charts:** Recharts 3.7
- **3D:** React Three Fiber 9.5 + Drei 10.7 + Three.js 0.182
- **Body Map (2D):** `react-body-highlighter` 2.0 + custom SVG paths
- **Icons:** Lucide React

### Dashboard Pages

| Route | Status | Description |
|---|---|---|
| `/dashboard` | ✅ Supabase | Overview with stats cards, training volume chart, readiness score |
| `/dashboard/workouts` | ✅ Supabase | Workout list with Swim/Bike/Run/Strength filters |
| `/dashboard/training` | ✅ Supabase | Training plan calendar with Day/Week/Month views |
| `/dashboard/coach` | ✅ Working | AI Coach chat with LangGraph streaming + conversation history |
| `/dashboard/body-map` | ✅ Supabase | 2D SVG interactive body map with muscle detail panel |
| `/dashboard/body-map-3d` | ⚠️ Partially working | 3D GLTF body model with R3F (crash fixes applied) |
| `/dashboard/settings` | ✅ Supabase | Profile management, dashboard view preferences |

### Security Headers

CSP configured in `next.config.ts`:

- `default-src 'self' capacitor://localhost ionic://localhost` — Capacitor WebView ready
- `connect-src` allows Supabase, Azure OpenAI, and Capacitor schemes
- `unsafe-eval` for Three.js WASM — **TODO: replace with nonce before App Store submission**
- HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff
- Permissions-Policy: camera=(), microphone=(), geolocation=()

### Design System: Liquid Glass

Implemented through CSS custom properties in `globals.css`. Full reference: [docs/design-system.md](./design-system.md).

### Data Layer

All hooks (`use-profile`, `use-workouts`, `use-training`, `use-coach`, `use-health`) are **connected to Supabase**. The `use-coach` hook communicates with the API (`NEXT_PUBLIC_API_URL`) for AI chat and uses Supabase directly for conversation history. The `use-planned-workouts` hook calls the API for planned workout CRUD.

> **Known Issue:** Dashboard occasionally fetches `undefined` URL → 404 (non-blocking, cosmetic).

---

## 6. Backend (API) — Current State

### Stack

- **Framework:** Hono 4 + `@hono/node-server`
- **Auth:** `hono/jwt` middleware + custom claims extraction
- **Rate Limiting:** Sliding-window in-memory limiter with Draft 7 `RateLimit-*` headers
- **AI:** `@langchain/langgraph` 1.1.4, `@langchain/openai` 0.4, `@langchain/core` 0.3
- **Validation:** Zod 4 schemas from `@triathlon/types`
- **DB:** `@supabase/supabase-js` 2
- **Testing:** Vitest 3
- **Dev:** tsx (watch mode)

### Middleware Stack

| Middleware | Route | Description |
|---|---|---|
| Logger | `*` | Request logging |
| Secure Headers | `*` | OWASP security headers |
| CORS | `*` | Allows `WEB_URL` env + `jpx-workout-web.azurewebsites.net` + `jpx.nu` |
| JWT Auth | `/api/*` | Validates Supabase JWT, extracts `userId`, `clubId`, `role` |
| Rate Limiter | `/api/ai/*` | 20 req/min per client for AI endpoints |

### AI Safety Guard

Integrated at the chat endpoint level (`services/ai/safety.ts`):

- **Emergency detection:** crisis/self-harm keywords → helpline resources, hard stop
- **Medical disclaimer:** auto-injected on health/nutrition/medical content
- **Input validation:** reject messages > 4000 chars
- **PII redaction:** emails, phone numbers, Swedish personnummer scrubbed from output
- **Confidence gating:** responses < 0.6 confidence flagged with extra disclaimers

### Endpoints

| Route | Method | Status | Description |
|---|---|---|---|
| `/health` | GET | ✅ Working | Health check with version, runtime info |
| `/api/ai/chat` | POST | ✅ Working | Safety-guarded LangGraph agent with SSE streaming |
| `/api/ai/conversations` | GET | ✅ Working | Lists user conversations with message counts |
| `/api/planned-workouts` | GET/POST | ✅ Working | Planned workout CRUD |
| `/webhooks/garmin/activities` | POST | ⚠️ Stub | Logs payload |
| `/webhooks/polar/activities` | POST | ⚠️ Stub | Logs payload |
| `/webhooks/wahoo/activities` | POST | ⚠️ Stub | Logs payload |
| `/webhooks/form/activities` | POST | ⚠️ Stub | Logs payload |

### Services (Scaffolded Directories)

| Service | Status |
|---|---|
| `services/ai/nodes/` | 📁 Empty — LangGraph state machine nodes |
| `services/ai/tools/` | 📁 Empty — Agent tools (RAG search, graph query, etc.) |
| `services/ingestion/` | 📁 Empty — PDF/document ingestion pipeline |
| `services/normalization/` | 📁 Empty — Webhook data normalization transformers |

---

## 7. Shared Packages

### `@triathlon/types` (`packages/types/`)

**Status: ✅ Complete**

**Domain Types** (`index.ts`):

- **Enums:** `ActivityType`, `DataSource`, `UserRole`, `RaceDistanceType`, `HealthMetricType`, `KGEntityType`, `KGRelationship`, `ChatIntent`, `ChatRole`
- **Interfaces:** `Club`, `Profile`, `Workout`, `DailyLog`, `Injury`, `HealthMetric`, `ChatMessage`, `StandardWorkout`

**Validation Schemas** (`validation.ts`) — Zod 4:

- `ChatMessageInput` — sanitized message + conversation UUID
- `WorkoutInput` — webhook payload with activity type, duration, distance, HR, pace, power
- `ProfileUpdate` — display name, timezone, avatar URL
- `DailyLogInput` — sleep, RPE, mood, HRV, weight
- `InjuryInput` — body part, severity
- `WebhookPayload` — source + raw payload
- `EnvSchema` — environment variable validation
- XSS-safe string sanitizer via `.transform()` (strips HTML tags)

### `packages/config/`

**Status: 📁 Scaffolded** — Empty, intended for shared ESLint/TS config.

---

## 8. CI/CD & Deployment

### CI Pipeline (`ci.yml`)

```
lint-and-typecheck → test → build → security-audit (main only)
```

- Uses Node.js 24
- Security audit step runs `scripts/security-audit.ts` (currently a stub, `continue-on-error: true`)

### Deployment (`deploy.yml`)

- **Trigger:** Push to `main` or manual dispatch
- **Web:** Builds Next.js standalone → copies to `deploy-web/` → deploys to `jpx-workout-web` (Azure App Service)
- **API:** Builds TypeScript → copies dist to `deploy-api/` → deploys to `jpx-workout-api` (Azure App Service)
- Node.js 24 in all jobs
- Dependencies: `pnpm` with `node-linker=hoisted` (`.npmrc`) for Azure compatibility
- `outputFileTracingRoot` set to monorepo root in `next.config.ts`
- **Custom domain:** Site served via `https://jpx.nu/workout` (reverse proxy to Azure)
- **Azure resource group:** `jpx-main-rg`

### GitHub Secrets (Repository)

| Secret | Purpose |
|---|---|
| `AZURE_CREDENTIALS` | Azure login for deployment |
| `AZURE_RESOURCE_GROUP` | Resource group name (`jpx-main-rg`) |
| `AZURE_OPENAI_ENDPOINT` | AI model endpoint |
| `AZURE_OPENAI_API_KEY` | AI authentication |
| `AZURE_OPENAI_DEPLOYMENT` | AI model name (e.g., `gpt-5-mini`) |
| `NEXT_PUBLIC_API_URL` | Frontend → API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client-side Supabase publishable key |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin key |
| `WEB_URL` | CORS allowed origin (`https://jpx.nu`) |

---

## 9. Agent Configuration

### Project Rules (`.gemini/rules.md`)

Comprehensive AI agent rules covering:

- Monorepo conventions, TypeScript strictness, Zod 4 usage
- Liquid Glass design system adherence
- Data layer `@mock`/`@real` annotation convention
- Backend security mandates (JWT, rate limiting, input validation)
- AI safety rules (emergency detection, medical disclaimers, PII redaction)
- Database RLS policies with `(select ...)` wrapper pattern
- **Native compatibility** — Capacitor WebView rules (safe areas, touch targets, no browser-only APIs, network awareness)
- Git conventional commits, environment variable naming

### Agent Workflows

- **`/dev`** (`.agent/workflows/dev.md`) — Starting dev servers, adding pages/routes/migrations
- **`/deploy`** (`.agent/workflows/deploy.md`) — Azure App Service deployment

---

## 10. Implementation Status by Phase

### Phase 1: "Iron Core" (Weeks 1–3) — ⚠️ ~80% Complete

| Task | Status | Notes |
|---|---|---|
| Monorepo setup (Turborepo + pnpm) | ✅ | Fully configured |
| Next.js 16 + React 19 + Compiler | ✅ | Working with standalone output |
| Hono API server | ✅ | Running with all middleware |
| Supabase schema (all 6 migrations) | ✅ | Comprehensive schema with optimized RLS |
| Shared types + validation package | ✅ | Domain types + Zod 4 schemas |
| CI/CD pipeline (GitHub Actions) | ✅ | CI + Deploy, Node.js 24 |
| Azure deployment config | ✅ | Web + API pipelines working |
| Liquid Glass design system | ✅ | CSS variables, dark/light mode, documented |
| Dashboard UI (all pages) | ✅ | Mock data, responsive layout |
| 2D Body Map (SVG) | ✅ | Interactive with detail panel |
| API auth middleware (JWT) | ✅ | Hono built-in jwt + claims extraction |
| API rate limiting | ✅ | Sliding window, Draft 7 headers |
| AI safety guard | ✅ | Emergency, medical, PII, confidence |
| Security headers (CSP) | ✅ | Capacitor-ready, HSTS, OWASP suite |
| Agent rules + workflows | ✅ | `.gemini/rules.md`, `/dev`, `/deploy` |
| 3D Body Map (R3F) | ⚠️ | Partially working (crash fixes applied) |
| Supabase Auth integration | ❌ | Hooks still use mock data |
| Connect frontend to Supabase | ❌ | Client exists but not wired |
| Security audit script | ❌ | Stub only |
| Capacitor.js initialization | ❌ | Not started |
| HealthKit/Health Connect bridge | ❌ | Not started |

### Phase 2: "Data Mesh" (Weeks 4–6) — ❌ Not Started

| Task | Status |
|---|---|
| Webhook receivers (Garmin/Polar/Wahoo/FORM) | ⚠️ Stub routes exist |
| Webhook signature validation | ❌ |
| Data normalization transformers | ❌ Service directory scaffolded |
| Document ingestion pipeline (PDF → chunks → embeddings) | ❌ Service directory scaffolded |
| Garmin/Polar developer API access | ❌ |
| FIT/TCX/JSON parsers | ❌ |

### Phase 3: "Agentic Brain" (Weeks 7–9) — ❌ Not Started

| Task | Status |
|---|---|
| LangGraph state machine (Triage → Context → Planner → Execution → Synthesis) | ❌ Directories scaffolded |
| Safety Check Node (emergency keyword detection) | ✅ Safety guard utility ready |
| Vector RAG search (using `match_documents` function) | ❌ DB function ready |
| Knowledge Graph traversal (using `traverse_athlete_graph`) | ❌ DB function ready |
| Azure OpenAI integration (GPT-4o + embeddings) | ❌ Env vars defined |
| Connect chat UI to LangGraph backend | ❌ |
| Conversation persistence (Supabase) | ❌ DB tables ready |

### Phase 4: "Liquid Experience" (Weeks 10–12) — ⚠️ Partially Started

| Task | Status |
|---|---|
| Liquid Glass design system | ✅ CSS variables + glass effects |
| Dashboard UI polish | ✅ Responsive, dark/light mode |
| 3D Muscle/Fatigue Map | ⚠️ R3F viewer exists, needs heatmap shader |
| Completion animations / micro-interactions | ❌ |
| Haptics (Capacitor Navigator.vibrate) | ❌ |
| Gamification UI (Virtual Relays) | ❌ DB tables ready |
| Taper/Zen Mode UI | ❌ |
| Realtime event broadcasting (Supabase Realtime) | ❌ |

---

## 11. Priority Work Queue

### Immediate (Phase 1 Completion)

1. **Wire Supabase auth** — Connect `lib/supabase/client.ts` to hooks, replace mock data
2. **Connect all hooks to Supabase** — Replace mock layer with real data fetching
3. **Fix 3D body map stability** — Ensure stable rendering with proper DRACO/GLTF loading
4. **Implement security audit** — Flesh out `scripts/security-audit.ts`

### Short-term (Phase 2: Data Mesh)

1. **Implement webhook validators** — Garmin signature, Polar token, Wahoo signature verification
2. **Build normalization service** — `StandardWorkout` transformers for each source
3. **Build document ingestion pipeline** — PDF parsing → chunking → Azure OpenAI embedding → pgvector

### Medium-term (Phase 3: Agentic Brain)

1. **Implement LangGraph agent** — State machine with Triage/Context/Planner/Execution/Synthesis nodes
2. **Wire RAG + KG retrieval** — Use `match_documents` + `traverse_athlete_graph` as LangGraph tools
3. **Connect chat UI to real agent** — Replace stub response with streaming LangGraph output

---

## 12. Native App Readiness (Capacitor.js)

### Strategy

- **MVP:** Web app served as a WebView via Capacitor pointing at the hosted URL
- **Integration Phase:** Capacitor plugins for HealthKit/Health Connect, push notifications, haptics

### Ready Now ✅

- CSP includes `capacitor://localhost` and `ionic://localhost`
- Agent rules enforce native-compatible patterns (safe areas, touch targets, no browser-only APIs)
- All routes use URL-safe paths (deep link compatible)

### Pending (Before App Store Submission)

| Item | Priority | Notes |
|---|---|---|
| Capacitor.js project init | High | `npx @capacitor/cli init` in `apps/mobile/` |
| HealthKit plugin (`@capacitor-community/health-connect`) | High | Bridges workout + HRV + sleep data |
| Health Connect plugin (Android) | High | Same data as HealthKit |
| Replace `unsafe-eval` in CSP | High | Apple App Store requirement |
| Push notifications (`@capacitor/push-notifications`) | Medium | Training reminders, relay updates |
| CSS safe area insets | Medium | `env(safe-area-inset-*)` for notch/dynamic island |
| Haptic feedback (`@capacitor/haptics`) | Low | Workout completion, streak milestones |
| Deep linking config | Low | URL scheme registration for `triathlon://` |
| Offline data caching (service worker) | Medium | Cached workouts/plans for offline access |
| Biometric auth (`@capacitor/biometric`) | Low | Face ID / fingerprint for quick access |

---

## 13. Key Configuration Notes

### pnpm + Azure Compatibility

- `.npmrc` contains `node-linker=hoisted` to avoid symlink issues on Azure App Service
- `next.config.ts` uses `outputFileTracingRoot` pointing to monorepo root for standalone tracing
- `WEBSITE_RUN_FROM_PACKAGE=1` must be set in Azure App Settings

### React Compiler

- Enabled via `reactCompiler: true` in `next.config.ts`
- `babel-plugin-react-compiler` 1.0.0 installed as dev dependency
- Provides automatic memoization for data-heavy dashboard components

### Vector Dimensions

- Embedding column uses `vector(2000)` — verify this matches the Azure OpenAI `text-embedding-3-large` model output dimensions (default is 3072, but dimensionality can be configured)

### RLS Security Model

- All tenant data isolated by `club_id` extracted from JWT `app_metadata`
- All RLS function calls wrapped in `(select ...)` for per-query evaluation performance
- No secondary lookup needed — `requesting_club_id()` reads directly from token
- Role-based access for admin operations via `app_metadata.role` in JWT

---

## 14. External Service Dependencies

| Service | Purpose | Status |
|---|---|---|
| **Supabase** | Database, Auth, Storage, Realtime | Project created, needs connection |
| **Azure App Service** | Web + API hosting | Configured in deploy workflow |
| **Azure OpenAI** | GPT-4o (reasoning) + text-embedding-3-large | Env vars defined, not connected |
| **Garmin Health API** | Workout data webhooks | Developer access needed |
| **Polar AccessLink** | Training + recovery data | Developer access needed |
| **Wahoo Cloud API** | Indoor cycling data | Developer access needed |
| **FORM Swim** | Swim metrics + HUD | Integration details TBD |

---

## 15. Security, Privacy & Compliance

As a platform handling sensitive health, biometric, and wearable data, JPx implements stringent security and compliance measures aligning with GDPR, EU AI Act, and EHDS (European Health Data Space) frameworks:

### Zero-Trust & Data Architecture

- **Strict Row-Level Security (RLS)**: Enforced via `(auth.jwt() ->> 'client_id') IS NULL` policies (using `AS RESTRICTIVE`) to prevent any external OAuth clients from querying sensitive raw health data directly. All core tables are safeguarded to ensure `athlete_id = auth.uid()`.
- **Secret Management**: API keys and secrets are loaded via environment variables, managed securely in Azure App Settings and verified by CI/CD Secret Scanning (Gitleaks).

### Privacy UX & Data Control

- **Data Control Center**: Built-in GDPR features within the user settings (`/dashboard/settings`), including 1-click **Export My Data** (JSON) for data portability, and **Delete Account & Data** for the right to be forgotten.
- **Granular Consent**: Explicit opt-in flows during wearable connection onboarding regarding the usage of HR, HRV, and sleep data for LLM personalization.

### High-Risk AI Provider Guardrails

- **Explainability & Human Oversight**: The EU AI Act (2026/2027) mandates explainability for High-Risk AI systems. The JPx UI automatically flags AI-generated workouts and includes a mandatory disclaimer requiring human oversight before execution.
- **Data Anonymization Pipeline**: AI requests pass through `PIIMiddleware` / Microsoft Presidio hooks (currently toggled behind a feature flag for testing) to sanitize PII prior to hitting the LLM context limits or LangSmith traces.
- **Zero-Retention**: Azure OpenAI enterprise integration guarantees a **Zero Data Retention** policy. Telemetry and prompts are transient and never used to train foundational AI models.

### Future-Proofing

- **EHDS Interoperability**: For future data liquidity, JPx has mapped an architectural path to FHIR (Fast Healthcare Interoperability Resources) data structures (`docs/EHDS_ARCHITECTURE.md`), preparing for seamless export and clinical system alignment when required by the EU.
