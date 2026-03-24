# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Orientation

Read before making changes:

1. `README.md`
2. `AGENTS.md`
3. `docs/technical-reference.md`
4. `docs/integrations.md` when touching OAuth, providers, webhooks, or integration settings
5. The nearest nested `AGENTS.md` in the subtree you are editing

## Architecture

Monorepo (`triathlon-app`) for a club-agnostic AI triathlon coaching platform.

```
apps/web          Next.js 16 + React 19 + Tailwind v4 + React Compiler
                  Port 3100, basePath /workout, Supabase client auth/SSR
apps/api          Hono + TypeScript, port 8787
                  LangGraph AI agent (21 tools), provider integrations, MCP bridge
                  Supabase JWKS auth, application/problem+json errors
apps/mobile       Flutter (outside pnpm/Turbo), same API contracts
packages/types    Shared Zod schemas and TypeScript contracts
packages/core     Shared pure logic (dates, stats, mapping, strength calcs)
packages/api-client  Typed Hono RPC client scaffold (not yet primary consumer path)
```

Key data flow: Web uses Supabase directly for reads (profiles, workouts, training plans, health) and calls the API for mutations, AI streaming (`/api/ai/stream` via Vercel AI SDK 6 `useChat`), planned workouts, and integrations. Mobile uses the same API contract.

AI Coach: LangGraph `StateGraph` with `llmCall -> tools -> llmCall` loop, Azure OpenAI backend, PostgreSQL-backed rate limiting, semantic memory with embeddings. Quick-log path skips full agent for simple workout logging.

## Development

```bash
pnpm install                           # install all workspaces
pnpm dev                               # start all apps via turbo
pnpm --filter web dev                  # web only (port 3100)
pnpm --filter @triathlon/api dev       # API only (port 8787)
```

Requires Node `24.x`, `pnpm@10.29.2`, and env vars from `.env.example`.

## Common Commands

```bash
# Linting and type-checking (Husky pre-commit runs both)
pnpm lint                              # biome check + web public env access guard
pnpm type-check                        # turbo type-check across all workspaces
pnpm format                            # biome format --write

# Testing
pnpm test                              # all workspace tests via turbo
pnpm --filter @triathlon/api test      # API unit tests (vitest)
pnpm --filter @triathlon/core test     # core package tests
pnpm --filter @triathlon/types test    # types package tests

# E2E
pnpm --filter @triathlon/api test:e2e  # API e2e (vitest, separate config)
pnpm --filter web test:e2e             # Playwright browser tests (auto-starts local stack)

# Single test file
cd apps/api && npx vitest run src/__tests__/my-test.test.ts
cd apps/api && npx vitest run --config vitest.e2e.config.ts src/__e2e__/my-test.e2e.ts

# Build
pnpm build                             # all workspaces
pnpm --filter web build                # web (validates routes/config/env)
pnpm --filter @triathlon/api build:deploy  # API deploy bundle -> dist-deploy/

# Env consistency
pnpm check:env-keys                    # validates env keys across .env.example, startup-env, deploy workflow
```

## Key Invariants

- `packages/types` and `packages/core` are prebuilt automatically via `build:deps` scripts before dev/test/build in consuming apps.
- Web code must not use dynamic `process.env[name]` inside `apps/web/src` — only static `process.env.NEXT_PUBLIC_*` property access. Enforced by `scripts/check-web-public-env-access.mjs`.
- `@/*` import alias is local to `apps/web` only.
- Do not author generated output (`apps/api/dist`, `apps/api/dist-deploy`, `apps/web/.next`, mobile build artifacts).
- Manual, browser, and e2e validation must use live data and real services. Mocked runs don't count as final verification unless the user explicitly approves.
- OAuth `returnTo` targets must be allowlisted absolute `http(s)` URLs. Mobile uses `APP_LINK_URL`.
- Supabase auth uses JWKS verification (not legacy shared JWT secret).
- Protected API routes prefer `app_metadata.club_id`/`role`, then fall back to `profiles` row.
- Keep docs and agent guidance in sync when routes, env vars, feature flags, deploy behavior, or product surface change.

## Validation Defaults

After any changes, always finish with:

```bash
pnpm lint && pnpm type-check
```

Then scope-specific checks:

- **Web**: `pnpm --filter web lint`, plus `pnpm --filter web build` for route/config/env changes
- **API**: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- **API AI/workout flows**: `pnpm --filter @triathlon/api test:e2e`
- **Shared packages**: targeted `pnpm --filter @triathlon/core test` or `pnpm --filter @triathlon/types test`
- **Cross-cutting**: `pnpm check:env-keys`, `pnpm type-check`, `pnpm test`

## Tech Stack Quick Reference

| Layer | Stack |
|-------|-------|
| Web framework | Next.js 16 App Router, React 19, React Compiler |
| Styling | Tailwind CSS v4 |
| API framework | Hono (Zod OpenAPI) |
| AI orchestration | LangGraph + Azure OpenAI, Vercel AI SDK 6 on client |
| Auth | Supabase (JWKS via jose) |
| Database | Supabase PostgreSQL |
| Testing | Vitest (API/packages), Playwright (web e2e) |
| Linting/formatting | Biome (not ESLint/Prettier) |
| PWA | Serwist |
| Observability | OpenTelemetry, Pino |
| Deploy | Azure App Service (API first, health-gated, then web) |

## Product Surface

Current shipped scope: web athlete cockpit (auth, onboarding, dashboard, workouts, training calendar, AI Coach, 2D body map, settings, integrations), API (AI, planned workouts, integrations, MCP, webhooks), mobile companion.

Not shipped: Garmin end-user availability, native health permission UX, live-data 3D body map, self-serve export/delete-account UI, squad features.

## Workflow Notes

- When investigating GitHub Actions, CI, or deploy failures, use the `github-actions-investigator` skill when available.
- Deploy: API deploys first, must pass `/health`, then web deploys and smoke-tests `/workout/`. GitHub Actions serializes `main` deploys.
- `AZURE_OPENAI_API_VERSION` defaults to `2024-12-01-preview` in code unless overridden.
