# AGENTS.md

Guidance for work inside `apps/`.

## Scope

- `apps/web` and `apps/api` are pnpm/Turbo workspaces.
- `apps/mobile` is a separate Flutter app.
- Each workspace has its own nested `AGENTS.md`. Read that file before editing within the app.

## Rules

- Keep app-specific concerns inside the app. Move cross-app contracts to `packages/types` and pure shared logic to `packages/core`.
- Respect the current shipped product surface documented in the root `README.md` and `docs/technical-reference.md`.
- Update app docs and root docs together when app routes, env vars, deploy behavior, or supported product surface change.
- Do not commit generated outputs such as `apps/api/dist`, `apps/api/dist-deploy`, `apps/web/.next`, or Flutter build artifacts.

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook runs both even when you changed only one workspace.
- Web: `pnpm --filter web lint`
- API: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- Mobile: run the smallest meaningful Flutter validation if the toolchain is available
