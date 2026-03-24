# Code Style and Conventions

## Language & Types
- Strict, explicit TypeScript — avoid `any`.
- Shared contracts and Zod validation schemas go in `packages/types`.
- Shared pure logic goes in `packages/core`.

## Formatting & Linting
- **Biome** for both linting and formatting (NOT ESLint/Prettier).
- `pnpm format` to auto-format, `pnpm lint` to check.

## Import Aliases
- `@/*` alias is local to `apps/web` only — do not use in other packages.

## API Conventions
- Input validation at the boundary.
- Protected routes under `/api/*`.
- Error responses use `application/problem+json` via existing helpers.
- Supabase JWKS auth (no legacy JWT secret).

## Web Conventions
- Public env access inside `apps/web/src` must be static `process.env.NEXT_PUBLIC_*` property reads. Dynamic `process.env[name]` is blocked.
- Web hooks and settings use live Supabase/API data — no mock-data fallbacks.

## General
- Keep changes focused and minimal.
- OAuth `returnTo` targets must be allowlisted absolute `http(s)` URLs.
- Do not author generated output (dist, .next, build artifacts).
- Keep docs and agent guidance in sync when routes, env vars, feature flags, or product surface change.