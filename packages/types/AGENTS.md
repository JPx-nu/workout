# AGENTS.md

Guidance for `packages/types`.

## Local Rules

- This package is the source of truth for shared TypeScript contracts and Zod validation schemas.
- Do not import app code from `apps/*`.
- Keep schema and type names stable unless there is a real contract change.
- When env, request, or response schemas change, also update the affected consumers, `.env.example`, `apps/api/src/config/startup-env.ts`, and docs as needed.
- Add or update tests under `src/__tests__` when changing shared validation or contract behavior.

## Validation

- `pnpm --filter @triathlon/types test`
- `pnpm --filter @triathlon/types type-check`
- `pnpm check:env-keys` when env schema changes are involved
