# AGENTS.md

Guidance for work inside `packages/`.

## Scope

- `packages/types` holds shared contracts and Zod schemas.
- `packages/core` holds shared pure business logic.
- `packages/api-client` holds the typed Hono RPC client scaffold.
- Read the package-specific `AGENTS.md` file before editing within one of these packages.

## Rules

- Keep shared packages reusable and app-agnostic.
- Avoid app-local aliases and framework-specific assumptions unless the package is explicitly for that framework boundary.
- When a shared contract changes, update the affected app docs and validation commands in the same change.

## Validation

- `pnpm --filter @triathlon/types test`
- `pnpm --filter @triathlon/types type-check`
- `pnpm --filter @triathlon/core test`
- `pnpm --filter @triathlon/core type-check`
- Use `pnpm type-check` when `packages/api-client` changes affect consumer typing
