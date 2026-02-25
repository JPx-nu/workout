# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Triathlon AI SaaS — pnpm + Turborepo monorepo with three main components:

| Service | Path | Port | Tech |
|---------|------|------|------|
| Web App | `apps/web` | 3000 | Next.js 16, React 19, Tailwind CSS 4 |
| API Server | `apps/api` | 8787 | Hono, LangChain/LangGraph, Azure OpenAI |
| Shared Types | `packages/types` | — | TypeScript + Zod |

A local **Supabase** stack (PostgreSQL 15 + pgvector, Auth, Storage, Realtime) is required and runs via Docker on ports 54321-54324.

### Running services

- **Supabase**: `npx supabase start` (requires Docker; pulls images on first run ~2min). Use `npx supabase status` to verify.
- **API**: `pnpm --filter @triathlon/api dev` (or `cd apps/api && npx tsx --env-file=.env src/server.ts`). Health check: `curl localhost:8787/health`.
- **Web**: `pnpm --filter web dev` (or `cd apps/web && npx next dev`). Serves at `http://localhost:3000/workout` (note the `/workout` basePath).

### Environment files

- `apps/web/.env.local` — needs `NEXT_PUBLIC_SUPABASE_URL` (use `http://localhost:54321`, **not** `127.0.0.1` — browsers can fail to resolve `127.0.0.1` in some containerized environments), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`.
- `apps/api/.env` — needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`. Azure OpenAI keys are optional (AI features degrade gracefully without them).
- Get local Supabase keys: `npx supabase status -o env`.

### Gotcha: demo login requires seeded data

The demo login button uses `demo@jpx.nu` / `demo1234`. This user must be created after `supabase start`:

1. Create the demo club via the REST API (service_role key) with id `00000000-0000-0000-0000-000000000001`.
2. Create the user via `/auth/v1/signup` with `data.club_id` set, so the `handle_new_user()` trigger can insert the profile row.

### Standard commands (see `package.json`)

- Lint: `pnpm lint`
- Type-check: `pnpm type-check`
- Tests: `pnpm test` (vitest in `apps/api`)
- Format: `pnpm format`

### Pre-commit hooks

Husky runs `pnpm lint` and `pnpm type-check` on commit via `.husky/pre-commit`.

### Docker in Cloud Agent VMs

Docker must be started manually: `sudo dockerd &>/tmp/dockerd.log &` then `sudo chmod 666 /var/run/docker.sock`. The daemon config uses `fuse-overlayfs` storage driver and `iptables-legacy`.
