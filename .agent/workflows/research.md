---
description: Research workflow for grounding repo changes in current local implementation and official docs when needed
---

# Research Workflow

1. Start with local sources:
   - `README.md`
   - `AGENTS.md`
   - nearest nested `AGENTS.md`
   - `docs/technical-reference.md`
   - `docs/integrations.md` when relevant

2. Identify the concrete topics that are unstable or easy to misremember:
   - framework-version behavior
   - deploy/runtime behavior
   - provider OAuth or webhook requirements
   - security-sensitive guidance

3. Inspect the local implementation before proposing changes:
   - workspace `package.json`
   - route entry points
   - config files such as `next.config.ts`, `apps/api/src/config/startup-env.ts`, and `.github/workflows/deploy.yml`

4. Use external research only when it is actually needed:
   - latest framework or provider behavior
   - security, legal, or deployment-sensitive questions
   - a user explicitly asks for verification

5. Prefer primary sources when you research externally:
   - official framework docs
   - provider docs
   - upstream release notes

6. Fold the findings back into implementation work:
   - adjust the code or docs
   - update repo guidance files if process assumptions changed
   - record any unresolved gap in `FOLLOWUP.md` when appropriate
