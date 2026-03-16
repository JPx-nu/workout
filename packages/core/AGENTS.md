# AGENTS.md

Guidance for `packages/core`.

## Local Rules

- Keep this package pure and deterministic. Avoid network calls, database clients, env access, or framework runtime code here.
- Prefer depending on `@triathlon/types` for shared domain shapes instead of duplicating them.
- Add or update tests for business logic changes, especially date math, stats, mapping, or strength calculations.

## Validation

- `pnpm --filter @triathlon/core test`
- `pnpm --filter @triathlon/core type-check`
