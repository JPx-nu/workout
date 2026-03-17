# AGENTS.md

Guidance for editing files under `docs/`.

## Local Rules

- Treat `docs/technical-reference.md` as implementation truth, not roadmap intent.
- Keep shipped, experimental, roadmap, and out-of-scope states clearly separated.
- Update explicit version or "Last Updated" markers when modifying docs that carry them.
- Keep env variable names exact and aligned with `.env.example`, `packages/types/src/validation.ts`, `apps/api/src/config/startup-env.ts`, and `.github/workflows/deploy.yml`.
- When repo guidance changes, keep doc references to `AGENTS.md`, nested `AGENTS.md`, `CLAUDE.md`, `.gemini/*`, and `.agent/*` aligned.
- Archived docs should not override current implementation-truth docs. Add or preserve pointers back to canonical docs when needed.

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook still runs those commands for docs-only changes.
- Re-read the touched docs against the actual source files they describe.
- Run `pnpm check:env-keys` when documentation changes mention env keys or deploy mappings.
