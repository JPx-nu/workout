---
description: Azure deployment workflow for the current triathlon-app repo
---

# Deployment Workflow

- Source of truth: `.github/workflows/deploy.yml`
- Trigger: push to `main` or `workflow_dispatch`
- Azure targets: `jpx-workout-api` and `jpx-workout-web`

## Key Build Steps

```bash
pnpm --filter @triathlon/api build:deploy
pnpm --filter web build
```

## Key Deploy Facts

- API deploy runs first and must pass `GET /health` before web deploy starts.
- Web health check path is `/workout/health`.
- API `API_URL` is sourced from `NEXT_PUBLIC_API_URL`.
- API `SUPABASE_ANON_KEY` is sourced from `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `INTEGRATION_ENCRYPTION_KEY` stays Azure-managed unless a GitHub override secret is provided.

## Verification

- `gh run list`
- `gh run view <run-id>`
- `az webapp log tail --name jpx-workout-api --resource-group <rg>`
- `az webapp log tail --name jpx-workout-web --resource-group <rg>`
