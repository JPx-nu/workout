---
description: Browser-testing workflow for local or deployed web verification
---

# Browser Testing Workflow

1. Use the correct target URL:
   - Local web app: `http://localhost:3100/workout/`
   - Deployed web app: `https://jpx-workout-web.azurewebsites.net/workout/` or the production custom domain

2. Capture diagnostics early:
   - browser console errors
   - failed network requests
   - response status codes for `/api/*` calls

3. Note the auth state before testing dashboard flows. Many features require a valid Supabase session.

4. Test within the current shipped surface unless you are explicitly checking an experimental route such as `/workout/dashboard/body-map-3d`.

5. When integrations or settings are involved, verify that links and API calls still honor the `/workout` basePath on the web side and the live `/api/integrations/status` contract.

6. Record exact repro steps, failing URLs, screenshots, and any `application/problem+json` responses so follow-up fixes are actionable.
