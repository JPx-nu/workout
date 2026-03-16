---
description: Current Azure deployment workflow for the triathlon-app monorepo
---

# Deployment Workflow

## Source of Truth

- The deploy pipeline lives in `.github/workflows/deploy.yml`.
- Preferred entry points are a push to `main` or `workflow_dispatch`.
- Keep repo docs and Azure behavior aligned through the workflow instead of hand-maintaining drift in Azure.

## Required GitHub Secrets

- `AZURE_CREDENTIALS`
- `AZURE_RESOURCE_GROUP`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WEB_URL`
- `NEXT_PUBLIC_API_URL`

Optional override secrets:
- `AZURE_OPENAI_API_VERSION`
- `INTEGRATION_ENCRYPTION_KEY`

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
5. Smoke-tests `GET /health` before deploying the web app.
6. Builds the web app with:
```bash
pnpm --filter web build
```
7. Packages the Next standalone output.
8. Configures the web app to Node `24.x`, `alwaysOn`, and health check `/workout/health`.
9. Smoke-tests `https://jpx-workout-web.azurewebsites.net/workout/`.

## Notes

- `apps/api/dist-deploy` is generated output, not source.
- `INTEGRATION_ENCRYPTION_KEY` remains Azure-managed unless a GitHub override secret is intentionally provided.
- `AZURE_OPENAI_API_VERSION` falls back to the code default `2024-12-01-preview` when not overridden.

## Verification Commands

- `gh run list`
- `gh run view <run-id>`
- `az webapp config appsettings list --name jpx-workout-api --resource-group <rg>`
- `az webapp config appsettings list --name jpx-workout-web --resource-group <rg>`
- `az webapp log tail --name jpx-workout-api --resource-group <rg>`
- `az webapp log tail --name jpx-workout-web --resource-group <rg>`
