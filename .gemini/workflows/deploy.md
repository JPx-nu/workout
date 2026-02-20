---
description: How to deploy the application to Azure App Service
---

// turbo-all

## Steps

1. Build the web app production bundle:
```bash
pnpm --filter web run build
```

2. Build the API:
```bash
pnpm --filter @triathlon/api run build
```

3. Deploy web app to Azure:
```bash
az webapp deploy --resource-group jpx-workout --name jpx-workout-web --src-path apps/web/.next/standalone
```

4. Deploy API to Azure:
```bash
az webapp deploy --resource-group jpx-workout --name jpx-workout-api --src-path apps/api/dist
```
