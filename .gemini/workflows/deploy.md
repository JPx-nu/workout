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
- The deploy workflow uses OIDC via `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`.
- Runtime secrets are read from Azure Key Vault `jpx-workout-kv-neu` through App Service Key Vault references and system-assigned managed identity.
- `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT` is optional; if unset, semantic memory recall is skipped.
- The deploy workflow smoke-tests the published AI path after web rollout with `node ./scripts/smoke-test-ai.mjs`.

## Verification

- `gh run list`
- `gh run view <run-id>`
- `az webapp log tail --name jpx-workout-api --resource-group <rg>`
- `az webapp log tail --name jpx-workout-web --resource-group <rg>`
