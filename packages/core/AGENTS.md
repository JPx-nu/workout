# AGENTS.md

Guidance for `packages/core`.

## Local Rules

- Keep this package pure and deterministic. Avoid network calls, database clients, env access, or framework runtime code here.
- Prefer depending on `@triathlon/types` for shared domain shapes instead of duplicating them.
- Add or update tests for business logic changes, especially date math, stats, mapping, or strength calculations.

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook runs both before commit.
- `pnpm --filter @triathlon/core test`
- `pnpm --filter @triathlon/core type-check`
