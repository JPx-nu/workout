---
description: How to deploy the application to Azure App Service
---

# Deployment Workflow

## Prerequisites
- Azure CLI installed and logged in
- GitHub secrets configured: `AZURE_CREDENTIALS`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Azure App Service instances: `jpx-workout-web`, `jpx-workout-api`
- Azure App Setting `WEBSITE_RUN_FROM_PACKAGE=1` set on both services

## Automatic Deployment (CI/CD)

Push to `main` branch triggers automatic deployment via GitHub Actions:
1. `ci.yml` — runs lint, type-check, test, build, security audit
2. `deploy.yml` — builds and deploys web + API to Azure

## Manual Deployment

// turbo-all

1. Build the project:
```bash
pnpm build
```

2. Prepare web deployment package:
```bash
cp -r apps/web/.next/standalone deploy-web
cp -r apps/web/public deploy-web/apps/web/public
mkdir -p deploy-web/apps/web/.next/static
cp -r apps/web/.next/static deploy-web/apps/web/.next/
```

3. Prepare API deployment package:
```bash
mkdir deploy-api
cp -r apps/api/dist deploy-api/
cp apps/api/package.json deploy-api/
cd deploy-api && npm install --omit=dev
```

4. Deploy to Azure:
```bash
az webapp deploy --resource-group <rg> --name jpx-workout-web --src-path ./deploy-web --type zip
az webapp deploy --resource-group <rg> --name jpx-workout-api --src-path ./deploy-api --type zip
```

## Post-Deployment Checks

1. Verify web app is running: `https://jpx-workout-web.azurewebsites.net`
2. Verify API health: `https://jpx-workout-api.azurewebsites.net/health`
3. Check security headers in browser DevTools → Network tab
4. Verify Supabase connectivity via dashboard page load
