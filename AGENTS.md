# AGENTS.md

Repository guidance for coding agents working in `c:\git\jpx\workout`.

## Start Here

Read these files before making assumptions:

1. `README.md`
2. This file
3. `docs/technical-reference.md`
4. `docs/integrations.md` when touching OAuth, providers, webhooks, or mobile/web integration settings
5. `FOLLOWUP.md` when checking known debt, open decisions, or unresolved scope gaps
6. The nearest nested `AGENTS.md` in the subtree you are editing

## Repo Snapshot

- Monorepo: `triathlon-app`
- Package manager: `pnpm@10.29.2`
- Task runner: `turbo`
- Shared runtime target: Node `24.x`
- Main workspaces:
  - `apps/web` - Next.js 16 + React 19 web app, dev port `3100`, basePath `/workout`
  - `apps/api` - Hono + TypeScript API, dev port `8787`
  - `packages/types` - shared contracts and Zod schemas
  - `packages/core` - shared pure business logic
  - `packages/api-client` - typed Hono RPC client scaffold
  - `apps/mobile` - Flutter app outside pnpm/Turbo

## Working Rules

- Keep changes focused and minimal unless the user explicitly asks for a broader refactor.
- Prefer strict, explicit TypeScript types over `any`.
- Put shared contracts and validation schemas in `packages/types`.
- Put shared pure logic in `packages/core`.
- Keep app-local aliases local. `@/*` is for `apps/web` only.
- Do not author generated output such as `apps/api/dist`, `apps/api/dist-deploy`, `apps/web/.next`, or mobile build artifacts.
- Web hooks and settings use live Supabase/API data. Do not reintroduce mock-data fallbacks.
- In `apps/web/src`, read public env keys with static `process.env.NEXT_PUBLIC_*` property access only. Dynamic `process.env[name]` access is blocked by `scripts/check-web-public-env-access.mjs`.
- API routes should validate inputs at the boundary, keep protected routes under `/api/*`, and use `application/problem+json` responses through the existing helpers.
- Supabase access tokens are verified through JWKS. Do not reintroduce a legacy shared JWT-secret flow.
- OAuth `returnTo` targets must remain allowlisted absolute `http(s)` URLs. Mobile uses `APP_LINK_URL`.
- Update docs and agent guidance in the same change when routes, env vars, feature flags, deploy behavior, or supported product surface change.

## Current Supported Product Surface

- Web: landing page, auth, onboarding, dashboard, workouts, training calendar, AI Coach, 2D body map, settings, integrations, and PWA install.
- API: AI routes, onboarding, planned workouts, integrations, mobile health ingest, MCP bridge, and provider webhooks.
- Mobile: login, dashboard, workouts, training, coach, body map, and settings backed by live API contracts.

Not currently shipped as supported product surface:

- Garmin end-user availability
- HealthKit / Health Connect permission UX
- Live-data 3D body map
- Self-serve export/delete-account UI
- Team relays or squad features

## Validation Before Handoff

After any repo changes, always run these root checks before handoff or commit because the Husky pre-commit hook runs them:

- `pnpm lint`
- `pnpm type-check`

Then run the smallest meaningful scope-specific checks for the files you changed, and broaden if needed:

- Web changes: `pnpm --filter web lint`
- Web route/config/env changes: `pnpm --filter web build`
- API changes: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- Shared package changes:
  - `pnpm --filter @triathlon/types test`
  - `pnpm --filter @triathlon/types type-check`
  - `pnpm --filter @triathlon/core test`
  - `pnpm --filter @triathlon/core type-check`
- Cross-cutting changes: `pnpm check:env-keys`, `pnpm type-check`, and `pnpm test` as appropriate

## Agent Guidance Surfaces

- Root and nested `AGENTS.md` files are the primary repo guidance for coding agents.
- `CLAUDE.md` mirrors the repo entry guidance for Claude-based agents.
- `.gemini/rules.md` and `.gemini/workflows/*` should stay aligned with the repo docs and nested `AGENTS.md` files.
- `.agent/workflows/*` contains local workflow recipes and must reflect current scripts, ports, and deploy flow.
- When investigating GitHub Actions, CI, or deploy failures, use the `github-actions-investigator` skill when it is available in the local Codex skills directory.

## Safe Auto-Run Commands

The following commands are safe to run without extra approval:

- `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm audit`, `pnpm list`, `pnpm why`, `pnpm check:env-keys`
- `pnpm --filter <workspace> lint`, `pnpm --filter <workspace> type-check`, `pnpm --filter <workspace> test`
- `pnpm install`, `pnpm install --frozen-lockfile`
- `gh run list`, `gh run view`, `gh api`, `gh secret list`
- `git status`, `git log`, `git diff`, `git fetch`, `git show`
- `az webapp config appsettings list`, `az webapp list`, `az webapp log tail`

## Notes

- Root formatting uses Biome: `pnpm format`.
- Web and API linting run through Biome. Keep rule-level changes explicit and scoped.
- The repo-level env consistency guard lives in `scripts/check-env-keys.mjs`.
