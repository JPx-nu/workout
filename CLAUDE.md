# CLAUDE.md

Start with these files before making changes:

1. `README.md`
2. `AGENTS.md`
3. `docs/technical-reference.md`
4. `docs/integrations.md` when touching OAuth, providers, webhooks, or integration settings
5. The nearest nested `AGENTS.md` in the subtree you are editing

Key repo invariants:

- Node `24.x`, `pnpm@10.29.2`, and `turbo` are the baseline toolchain.
- `apps/web` runs on port `3100` with basePath `/workout`.
- `apps/api` runs on port `8787` and uses JWKS-backed Supabase token verification plus `application/problem+json` error responses.
- `apps/mobile` is a Flutter app outside pnpm/Turbo. OAuth return targets use allowlisted absolute `http(s)` `APP_LINK_URL` values.
- Shared contracts belong in `packages/types`. Shared pure logic belongs in `packages/core`.
- Do not author generated output such as `apps/api/dist`, `apps/api/dist-deploy`, `apps/web/.next`, or mobile build artifacts.
- Web code must not use dynamic `process.env[name]` access inside `apps/web/src`.
- Manual, browser, and end-to-end validation must use live data and real services. Stubbed or mocked runs do not count as final verification unless the user explicitly approves an exception.
- Keep docs and agent guidance in sync when routes, env vars, feature flags, deploy behavior, or supported product surface change.

Current shipped product surface excludes Garmin end-user availability, native health permission UX, live-data 3D body map, self-serve export/delete-account UI, and squad features.

Validation defaults:

- After any repo changes, always finish with `pnpm lint` and `pnpm type-check`. The Husky pre-commit hook runs those exact commands.
- Web: `pnpm --filter web lint`, plus `pnpm --filter web build` for route/config/env changes
- API: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- API AI coach or workout logging flow changes: `pnpm --filter @triathlon/api test:e2e`
- Shared packages: targeted `pnpm --filter ... test` and `pnpm --filter ... type-check`
- Cross-cutting changes: `pnpm check:env-keys`, `pnpm type-check`, `pnpm test`

Workflow note:

- When investigating GitHub Actions, CI, or deploy failures, use the `github-actions-investigator` skill when it is available in the local Codex skills directory.
