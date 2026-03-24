# Task Completion Checklist

After any changes, always run:

```bash
pnpm lint && pnpm type-check
```

Then scope-specific checks based on what changed:

- **Web changes**: `pnpm --filter web lint`
- **Web route/config/env changes**: also `pnpm --filter web build`
- **API changes**: `pnpm --filter @triathlon/api test` and `pnpm --filter @triathlon/api type-check`
- **API AI/workout flow changes**: also `pnpm --filter @triathlon/api test:e2e`
- **Shared packages**: `pnpm --filter @triathlon/core test` or `pnpm --filter @triathlon/types test`
- **Cross-cutting changes**: `pnpm check:env-keys`, `pnpm type-check`, `pnpm test`

## Important
- Manual, browser, and e2e validation must use live data and real services. Mocked runs don't count as final verification unless explicitly approved.
- `packages/types` and `packages/core` are prebuilt automatically via `build:deps` scripts before dev/test/build.