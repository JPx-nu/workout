---
description: Current development workflow for the triathlon-app monorepo
---

# Development Workflow

## Root Tasks

1. Install dependencies:
```bash
pnpm install
```

2. Start the repo in development mode:
```bash
pnpm dev
```

Target a single workspace when you do not need the full repo:
- Web: `pnpm --filter web dev`
- API: `pnpm --filter @triathlon/api dev`

Local defaults:
- Web: `http://localhost:3100/workout`
- API: `http://localhost:8787`

## Web Changes

1. Add or update routes under `apps/web/src/app`.
2. Reuse live hooks under `apps/web/src/hooks` instead of reintroducing mock layers.
3. Keep public env reads inside `apps/web/src` as static `process.env.NEXT_PUBLIC_*` access.
4. Validate with:
```bash
pnpm --filter web lint
```
5. Add a production build check for route, config, CSP, or env changes:
```bash
pnpm --filter web build
```

## API Changes

1. Add or update route groups under `apps/api/src/routes`.
2. Reuse shared schemas from `@triathlon/types` at the route boundary.
3. Register route groups in `apps/api/src/server.ts` when adding a new surface.
4. Keep protected routes under `/api/*`; `/health` and `/webhooks/*` are the public entry points.
5. Validate with:
```bash
pnpm --filter @triathlon/api test
pnpm --filter @triathlon/api type-check
```

## Shared Package Changes

- Types:
```bash
pnpm --filter @triathlon/types test
pnpm --filter @triathlon/types type-check
```

- Core:
```bash
pnpm --filter @triathlon/core test
pnpm --filter @triathlon/core type-check
```

## Mobile

The Flutter app is separate from pnpm/Turbo:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=... --dart-define=API_URL=http://localhost:8787 --dart-define=APP_LINK_URL=https://jpx.nu/workout/settings
```

`APP_LINK_URL` must be an allowlisted absolute `http(s)` URL.
