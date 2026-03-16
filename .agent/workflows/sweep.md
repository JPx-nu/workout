---
description: Full repo sweep for dependency drift, stale guidance, dead code, and validation
---

# Full Codebase Sweep

## 1. Dependency and Security Review

```bash
pnpm outdated --recursive
pnpm audit
```

- Review critical framework, auth, and deploy dependencies before upgrading.
- Prefer targeted upgrades over broad churn unless the sweep is explicitly for a larger refresh.

## 2. Guidance Drift Check

Compare these sources and keep them aligned:
- `README.md`
- `AGENTS.md`
- nested `AGENTS.md` files
- `CLAUDE.md`
- `.gemini/rules.md`
- `.gemini/workflows/*`
- `.agent/workflows/*`
- `docs/technical-reference.md`
- `docs/integrations.md`

## 3. Stale Reference Search

Useful searches:

```bash
rg -n "NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET|lib/mock|npm run dev|http://localhost:3000|Capacitor" .
rg -n "TODO|FIXME" apps packages scripts
```

- Remove stale env names, old ports, and obsolete architecture guidance when you find them.
- Keep mock-data references out of the current web data layer docs and workflow files.

## 4. Validation

```bash
pnpm check:env-keys
pnpm lint
pnpm type-check
pnpm test
```

Add targeted builds when relevant:
- `pnpm --filter web build`
- `pnpm --filter @triathlon/api build:deploy`

## 5. Docs and Scope

- Verify the documented shipped surface still matches the current product.
- Keep unsupported or experimental items clearly marked.
- Update env, route, and deploy notes when behavior changed.

## 6. Handoff

- Summarize findings, fixes, and any residual risks.
- Do not auto-commit or auto-push as part of the sweep unless explicitly requested.
