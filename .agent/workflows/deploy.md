---
description: Current Azure deployment workflow for the triathlon-app monorepo
---

# Deployment Workflow

## Source of Truth

- The deploy pipeline lives in `.github/workflows/deploy.yml`.
- Preferred entry points are a push to `main` or `workflow_dispatch`.
- Keep repo docs and Azure behavior aligned through the workflow instead of hand-maintaining drift in Azure.

## Required GitHub Secrets

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_KEY_VAULT_NAME`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `WEB_URL`
- `NEXT_PUBLIC_API_URL`

Optional override secrets:
- `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`

## What the Workflow Does

1. Builds the API with:
```bash
pnpm --filter @triathlon/api build:deploy
```
2. Packages `apps/api/dist-deploy` and installs only deployment dependencies.
3. Configures the API app to Node `24.x`, `alwaysOn`, startup file `node server.js`, and health check `/health`.
4. Applies API app settings, mapping:
   - `API_URL` <- `NEXT_PUBLIC_API_URL`
   - `SUPABASE_ANON_KEY` <- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `AZURE_OPENAI_API_KEY` <- Key Vault reference
   - `SUPABASE_SERVICE_ROLE_KEY` <- Key Vault reference
   - `INTEGRATION_ENCRYPTION_KEY` <- Key Vault reference
   - `APP_ENV` <- `prod`
   - `FEATURE_AI_ENABLED` <- `true`
   - `FEATURE_INTEGRATIONS_ENABLED` <- `true`
   - `FEATURE_MCP_ENABLED` <- `true`
5. Smoke-tests `GET /health` before deploying the web app.
6. Builds the web app with:
```bash
pnpm --filter web build
```
7. Packages the Next standalone output.
8. Configures the web app to Node `24.x`, `alwaysOn`, and health check `/workout/health`.
9. Smoke-tests `https://jpx-workout-web.azurewebsites.net/workout/`.
10. Smoke-tests the published `/api/ai/stream` path with `node ./scripts/smoke-test-ai.mjs`.

## Notes

- `apps/api/dist-deploy` is generated output, not source.
- The workflow uses OIDC via `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`.
- Runtime secrets are read from Azure Key Vault `jpx-workout-kv-neu` via App Service Key Vault references and system-assigned managed identity.
- `AZURE_OPENAI_API_VERSION` is pinned in the workflow to `2024-12-01-preview`.
- `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT` is optional. When it is unset, semantic memory recall is skipped instead of assuming an embeddings deployment exists.

## Verification Commands

- `gh run list`
- `gh run view <run-id>`
- `az webapp config appsettings list --name jpx-workout-api --resource-group <rg>`
- `az webapp config appsettings list --name jpx-workout-web --resource-group <rg>`
- `az webapp log tail --name jpx-workout-api --resource-group <rg>`
- `az webapp log tail --name jpx-workout-web --resource-group <rg>`
