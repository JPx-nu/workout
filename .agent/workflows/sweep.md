---
description: Full codebase sweep — dependency audit, dead code removal, security checks, and best practice alignment
---

# /sweep — Full Codebase Sweep

Run this workflow periodically (after major features, before releases) to keep the codebase in pristine condition.

// turbo-all

## 1. Dependency Audit

```bash
pnpm outdated --recursive
```

- Check each outdated package against its changelog for breaking changes
- Research latest versions on Context7 and npm for critical frameworks (Next.js, Hono, LangChain, Supabase)
- Look for **security advisories** (especially Hono, Supabase, jose)
- Update packages: `pnpm update --recursive` for patch/minor, manual for major

## 2. Dead Code Scan

- Search for unused imports: `grep -r "from.*mock" apps/web/src/`
- Search for unreferenced files: check every file in `lib/` has at least one import
- Look for empty directories (scaffolded but never implemented)
- Check for TODO/FIXME comments that should be resolved
- Verify all exports in `packages/types/` are actually used

## 3. Framework Best Practices

- **Next.js**: Check the [upgrade guide](https://nextjs.org/docs/app/building-your-application/upgrading) for missed features
- **Hono**: Verify middleware patterns match [latest docs](https://hono.dev/docs)
- **LangGraph**: Check for new agent patterns, streaming improvements
- **Supabase**: Verify RLS policies, check for new Auth features
- Use Context7 to query latest docs for each framework

## 4. Security Checklist

- [ ] CSP headers up to date (no unnecessary `unsafe-*`)
- [ ] All API inputs validated with Zod
- [ ] No secrets in client-side code (search for `SUPABASE_SERVICE_ROLE`, API keys)
- [ ] Rate limiting active on all public endpoints
- [ ] CORS origins correct (check for hardcoded dev URLs in production)
- [ ] Dependency audit: `pnpm audit`

## 5. Build & Type Safety

```bash
pnpm lint
pnpm type-check
pnpm build
```

- Fix ALL lint warnings (not just errors)
- Resolve any TypeScript `any` types that crept in

## 6. Documentation Sync

- Update `docs/technical-reference.md` version and date
- Verify all endpoints listed match actual routes
- Verify all pages listed match actual routes
- Update GitHub Secrets table if any changed
- Check that `.env.example` matches actual env vars used

## 7. Commit & Deploy

```bash
git add -A
git commit -m "chore: full codebase sweep — deps, cleanup, security"
git push
```
