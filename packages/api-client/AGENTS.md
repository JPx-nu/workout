# AGENTS.md

Guidance for `packages/api-client`.

## Local Rules

- Keep this package thin. It should stay a typed Hono RPC client scaffold, not a place for app state, env loading, or platform-specific behavior.
- Preserve end-to-end typing by importing `AppType` from `@triathlon/api`.
- Avoid hardcoding deployment URLs or auth storage assumptions. Consumers should pass the base URL and optional bearer token.
- This package is not broadly adopted yet. If you materially change its surface, update the relevant docs or backlog notes so the adoption story stays accurate.

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook runs those commands before commit.
- `pnpm type-check`
- Run any affected consumer build or type-check if the exported client surface changes
