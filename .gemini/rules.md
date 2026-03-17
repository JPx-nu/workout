# Triathlon App Project Rules

## Start Here

Read these files before making assumptions:

1. `README.md`
2. `AGENTS.md`
3. `docs/technical-reference.md`
4. `docs/integrations.md` when touching OAuth, providers, webhooks, or integration settings
5. The nearest nested `AGENTS.md` in the subtree you are editing

## Repo Shape

- Monorepo: `triathlon-app`
- Package manager: `pnpm@10.29.2`
- Task runner: `turbo`
- Runtime target: Node `24.x`
- Web: `apps/web`, Next.js 16 + React 19, dev port `3100`, basePath `/workout`
- API: `apps/api`, Hono + TypeScript, dev port `8787`
- Shared packages: `packages/types`, `packages/core`, `packages/api-client`
- Mobile: `apps/mobile`, Flutter app outside pnpm/Turbo

## Non-Negotiable Rules

- Keep shared contracts and Zod schemas in `packages/types`.
- Keep shared pure logic in `packages/core`.
- Do not author generated output such as `apps/api/dist`, `apps/api/dist-deploy`, or `apps/web/.next`.
- Web data hooks use live Supabase/API sources. Do not bring back mock-data fallbacks.
- In `apps/web/src`, use static `process.env.NEXT_PUBLIC_*` property access only.
- API routes should validate inputs at the boundary and use the existing problem-details helpers for non-2xx responses.
- Supabase access tokens are verified through JWKS. Do not reintroduce a shared JWT secret flow.
- OAuth `returnTo` targets must remain allowlisted absolute `http(s)` URLs. Mobile uses `APP_LINK_URL`.
- Keep docs and agent guidance in sync when routes, env vars, deploy behavior, feature flags, or supported product surface change.

## Current Supported Product Surface

- Web: landing page, auth, onboarding, dashboard, workouts, training, AI Coach, 2D body map, settings, integrations, PWA install
- API: AI routes, onboarding, planned workouts, integrations, mobile health ingest, MCP, provider webhooks
- Mobile: login, dashboard, workouts, training, coach, body map, settings backed by live API contracts

Not currently supported as shipped surface:
- Garmin end-user availability
- HealthKit / Health Connect permission UX
- Live-data 3D body map
- Self-serve export/delete-account UI
- Team relays or squad features

## Validation Defaults

- After any repo changes, always finish with `pnpm lint` and `pnpm type-check`. The Husky pre-commit hook runs those exact commands.
- Web: `pnpm --filter web lint`
- Web route/config/env changes: `pnpm --filter web build`
- API: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- Shared packages:
  - `pnpm --filter @triathlon/types test`
  - `pnpm --filter @triathlon/types type-check`
  - `pnpm --filter @triathlon/core test`
  - `pnpm --filter @triathlon/core type-check`
- Cross-cutting changes: `pnpm check:env-keys`, `pnpm type-check`, `pnpm test`

## Docs to Keep Aligned

- `README.md`
- `AGENTS.md` and nested `AGENTS.md`
- `CLAUDE.md`
- `.gemini/workflows/*`
- `.agent/workflows/*`
- `docs/technical-reference.md`
- `docs/integrations.md`
- `docs/web-v1-feature-matrix.md`
