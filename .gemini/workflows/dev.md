---
description: Development workflow for the current triathlon-app repo
---

# Development Workflow

## Start Services

From repo root:

```bash
pnpm dev
```

Target a single workspace when needed:

```bash
pnpm --filter web dev
pnpm --filter @triathlon/api dev
```

Local defaults:
- Web: `http://localhost:3100/workout`
- API: `http://localhost:8787`

## Validation

- Web: `pnpm --filter web lint`
- API: `pnpm --filter @triathlon/api test && pnpm --filter @triathlon/api type-check`
- Shared packages: targeted `pnpm --filter ... test` and `pnpm --filter ... type-check`
- Cross-cutting: `pnpm check:env-keys`, `pnpm type-check`, `pnpm test`

## Notes

- Web uses live Supabase/API data. Do not add mock-data fallbacks.
- Mobile is a separate Flutter app under `apps/mobile`, not part of `pnpm dev`.
