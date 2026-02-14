---
description: How to run the development environment and common development tasks
---

# Development Workflow

## Starting the Dev Environment

// turbo-all

1. Install dependencies (if needed):
```bash
pnpm install
```

2. Start both web and API dev servers:
```bash
pnpm dev
```
This runs `turbo dev` which starts:
- **Web**: `http://localhost:3000` (Next.js)
- **API**: `http://localhost:8787` (Hono)

## Adding a New Dashboard Page

1. Create the page file at `apps/web/src/app/dashboard/<page-name>/page.tsx`
2. Add `'use client'` directive at top
3. Add the route to the `navItems` array in `apps/web/src/app/dashboard/layout.tsx`
4. Create a data hook at `apps/web/src/hooks/use-<feature>.ts` with `@mock` annotation
5. Create mock data at `apps/web/src/lib/mock/<feature>.ts` and export from `apps/web/src/lib/mock/index.ts`
6. Use Liquid Glass design system classes: `glass-card`, `btn-primary`, `badge-*`
7. Use CSS variables for all colors — never hardcode

## Adding a New API Route

1. Create the route file at `apps/api/src/routes/<group>/<route>.ts`
2. Export a `Hono` instance with route handlers
3. Add Zod input validation using schemas from `@triathlon/types/validation`
4. Register the route in `apps/api/src/server.ts` via `app.route()`
5. Add auth middleware for protected routes

## Creating a Database Migration

1. Create a new SQL file: `supabase/migrations/NNNNN_description.sql`
2. Use sequential numbering (next after the highest existing)
3. Always add RLS policies using `club_id = (select public.requesting_club_id())`
4. Add matching TypeScript types in `packages/types/src/index.ts`
5. Test locally with `supabase db reset`

## Running Tests

1. Run all tests:
```bash
pnpm test
```

2. Run type checking:
```bash
pnpm type-check
```

3. Run linting:
```bash
pnpm lint
```

4. Run the full CI pipeline locally:
```bash
pnpm type-check && pnpm lint && pnpm test && pnpm build
```
