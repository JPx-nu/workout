# AGENTS.md

Guidance for coding agents working in this repository.

## Repository overview

- Monorepo name: `triathlon-app`
- Package manager: `pnpm` (`pnpm@10.29.2`)
- Task runner: `turbo`
- Main workspaces:
  - `apps/web` - Next.js 16 + React 19 frontend
  - `apps/api` - Hono + TypeScript backend
  - `packages/types` - shared TypeScript types

## Setup

1. Install dependencies:
   - `pnpm install`
2. Create local environment file:
   - `cp .env.example .env`
3. Fill required environment variables (Supabase, Azure OpenAI, webhook keys).

## Common commands

From repository root:

- `pnpm dev` - run all dev tasks through Turbo
- `pnpm build` - build all packages/apps
- `pnpm lint` - lint configured packages
- `pnpm type-check` - run TypeScript checks
- `pnpm test` - run tests
- `pnpm test:e2e` - run end-to-end test tasks (if configured)

Target a specific workspace when possible:

- `pnpm --filter web dev`
- `pnpm --filter @triathlon/api dev`
- `pnpm --filter @triathlon/api test`
- `pnpm --filter @triathlon/types type-check`

## Coding guidelines for agents

- Keep changes focused and minimal; avoid broad refactors unless requested.
- Prefer strict, explicit TypeScript types over `any`.
- Reuse shared contracts from `packages/types` for cross-app data shapes.
- Keep imports/package boundaries clear (each app has its own `@/*` alias).
- Do not commit secrets, `.env` files, or generated build outputs.
- Update docs when behavior, environment requirements, or workflows change.

## Validation before handoff

Run the smallest meaningful checks for the files you changed, then broaden if needed:

- Web changes: `pnpm --filter web lint` and/or `pnpm --filter web build`
- API changes: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- Cross-cutting changes: `pnpm type-check` (and `pnpm test` when relevant)

## Notes

- Root formatting uses Prettier (`pnpm format`).
- Web ESLint config intentionally relaxes some React hooks rules during scaffold stage; do not tighten these without a specific request.
