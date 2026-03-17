# AGENTS.md

Guidance for `apps/web`.

## Start Here

- Read `apps/web/README.md`.
- Read `apps/web/docs/MOCK_DATA_MIGRATION.md` when touching data hooks or API/Supabase sourcing.
- Check the root `AGENTS.md` and `docs/technical-reference.md` for repo-wide constraints.

## Local Rules

- This app uses Next.js 16 App Router, React 19, Tailwind CSS v4, and React Compiler.
- Dev port is `3100`. The deployed app serves under basePath `/workout`.
- The `@/*` import alias is local to this workspace.
- Keep data hooks backed by live Supabase or API calls. Do not reintroduce `src/lib/mock` or local placeholder data flows.
- Read public env vars in `apps/web/src` with static `process.env.NEXT_PUBLIC_*` property access only. `pnpm lint` runs `scripts/check-web-public-env-access.mjs` and will fail dynamic access.
- Reuse `src/lib/constants.ts` and existing hook patterns for API base URLs and auth-aware fetches.
- If you touch settings or integrations, preserve the live `/api/integrations/status` contract and action-route flow.
- `dashboard/body-map-3d` remains experimental. Do not document it as supported web-v1 surface unless the underlying product decision changes.

## Docs to Update When Behavior Changes

- `apps/web/README.md`
- `docs/technical-reference.md`
- `docs/web-v1-feature-matrix.md`
- Root `README.md` if the shipped surface or env story changes

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook runs both and can still block the commit after targeted web checks pass.
- `pnpm --filter web lint`
- `pnpm --filter web build` for route, config, CSP, env, or deployment-behavior changes
