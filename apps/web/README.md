# Web App (`apps/web`)

Next.js 16 frontend for the triathlon platform.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Supabase auth/data client
- Vercel AI SDK chat client (`@ai-sdk/react`)

## Local development

From repo root:

```bash
pnpm --filter web dev
```

Default port: `3100`.

## Required env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WEB_URL`

Optional feature flags:

- `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
- `NEXT_PUBLIC_ENABLE_DEMO`

## App notes

- `basePath` is `/workout` (see `next.config.ts`).
- AI coach UI streams through API route `/api/ai/stream`.
- Planned workouts use API route `/api/planned-workouts`.
- Auth and profile/dashboard views use Supabase directly from client hooks.
- In deployed environments, `NEXT_PUBLIC_API_URL` must point at the real API origin. Web CSP `connect-src` is built from that value at build time.

## Build

```bash
pnpm --filter web build
pnpm --filter web start
```
