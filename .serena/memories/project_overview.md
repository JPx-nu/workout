# Project Overview

**Name:** triathlon-app (workout)
**Purpose:** Club-agnostic AI triathlon coaching platform — monorepo with web cockpit, API, shared packages, and mobile companion.

## Workspaces

- `apps/web` — Next.js 16 + React 19 + Tailwind v4 + React Compiler. Port 3100, basePath `/workout`. Supabase client auth/SSR.
- `apps/api` — Hono + TypeScript API. Port 8787. LangGraph AI agent (21 tools), provider integrations, MCP bridge. Supabase JWKS auth, `application/problem+json` errors.
- `apps/mobile` — Flutter app (outside pnpm/Turbo), same API contracts.
- `packages/types` — Shared Zod schemas and TypeScript contracts.
- `packages/core` — Shared pure logic (dates, stats, mapping, strength calcs).
- `packages/api-client` — Typed Hono RPC client scaffold (not yet primary consumer path).

## Key Data Flow

- Web reads from Supabase directly (profiles, workouts, training plans, health) and calls the API for mutations, AI streaming (`/api/ai/stream` via Vercel AI SDK 6 `useChat`), planned workouts, and integrations.
- Mobile uses the same API contract.
- AI Coach: LangGraph `StateGraph` with `llmCall -> tools -> llmCall` loop, Azure OpenAI backend, PostgreSQL-backed rate limiting, semantic memory with embeddings.

## Product Surface

Shipped: web athlete cockpit (auth, onboarding, dashboard, workouts, training calendar, AI Coach, 2D body map, settings, integrations), API (AI, planned workouts, integrations, MCP, webhooks), mobile companion.

Not shipped: Garmin end-user availability, native health permission UX, live-data 3D body map, self-serve export/delete-account UI, squad features.