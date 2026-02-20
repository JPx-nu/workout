# Triathlon AI SaaS — Project Rules

## Monorepo Structure
- This is a **Turborepo + pnpm workspace** monorepo with `apps/web`, `apps/api`, `packages/types`, `packages/config`
- Always use workspace references: `@triathlon/types`, `@triathlon/api`
- Never install a dependency in the root unless it's a dev tool used by all packages

## TypeScript
- **Strict mode** is mandatory — never use `any` or `@ts-ignore`
- All domain types live in `packages/types/src/index.ts` — import from `@triathlon/types`
- Use **Zod 4** for runtime validation at API boundaries — schemas live in `packages/types/src/validation.ts`
- Prefer `z.interface()` over `z.object()` for API input schemas (Zod 4 feature)
- Use `z.email()`, `z.uuid()`, `z.url()` top-level format helpers

## Frontend (apps/web)
- **Next.js 16** App Router with React 19 + React Compiler
- **Tailwind CSS v4** with the Liquid Glass design system
- **Never hardcode colors** — always use CSS variables from `globals.css` (e.g., `var(--color-brand)`, `var(--color-glass-bg)`)
- **Never use inline oklch or hex values** — reference design tokens
- Glass components: use `.glass-card`, `.glass-sidebar`, `.glass-input` classes
- Buttons: `.btn-primary`, `.btn-ghost`
- Badges: `.badge-swim`, `.badge-bike`, `.badge-run`, `.badge-strength`
- Animations: `.animate-fade-in`, `.animate-slide-in`, `.animate-pulse-glow`, `.stagger-children`
- **Accessible by default**: all interactive elements must have `:focus-visible` styles, proper `aria-*` attributes, and respect `prefers-reduced-motion`
- Icons: use `lucide-react` exclusively

## Data Layer Convention
- Hooks that currently use mock data are annotated with `// @mock` comments
- When swapping to real data, update the comment to `// @real` and change the import from `@/lib/mock` to Supabase queries
- Keep the same hook API surface so pages don't need changes
- Supabase client: use `@supabase/ssr` for server components, `createBrowserClient` for client

## Backend (apps/api)
- **Hono** framework on Node.js
- Auth: use Hono's built-in `jwt` middleware from `hono/jwt` — validates Supabase JWTs
- Rate limiting: sliding window rate limiter on AI endpoints (20 req/min), reads (100 req/min)
- All API inputs must be validated with Zod schemas before processing
- Never trust client-side data — always re-validate on the server

## AI Safety (CRITICAL)
- **Emergency detection**: if user input contains crisis/self-harm keywords, immediately return helpline resources and refuse further AI processing
- **Medical disclaimer**: all health/nutrition/medical advice from AI Coach MUST include a disclaimer that it's not medical advice
- **Input validation**: reject messages > 4000 characters
- **Output filtering**: scan AI responses for PII patterns (emails, phone numbers) and redact before sending
- **No diagnosis**: AI Coach must never diagnose conditions, only suggest consulting professionals
- **Confidence gating**: flag responses with confidence < 0.6 and add extra disclaimers

## Database & Security
- **RLS is mandatory** on every table — use `club_id = (select public.requesting_club_id())` pattern
- Performance: use `(select auth.uid())` wrapper in RLS policies (not bare `auth.uid()`)
- Custom claims: `club_id` and `role` injected into JWT via `custom_access_token_hook`
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code
- All migrations go in `supabase/migrations/` with sequential numbering `NNNNN_description.sql`

## Git & CI/CD
- CI runs: `lint → type-check → test → build → security-audit` (on main)
- Deploy via GitHub Actions to Azure App Service (`jpx-workout-web`, `jpx-workout-api`)
- PR branches must pass CI before merge
- Commit messages: use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)

## Native Compatibility (Capacitor WebView)
- **MVP runs as a WebView** inside Capacitor.js for iOS/Android — every feature must work in a WebView context
- **Never use browser-only APIs** without a Capacitor fallback (e.g., `navigator.geolocation` → `@capacitor/geolocation`, `navigator.share` → `@capacitor/share`)
- **CSS safe areas**: always use `env(safe-area-inset-top)`, etc. in layouts that touch screen edges (header, bottom nav, modals)
- **No `window.open()` for auth flows** — use in-app browser or Capacitor's `@capacitor/browser` plugin
- **Storage**: prefer Supabase/API calls over `localStorage` — WebView `localStorage` can be cleared by the OS
- **Deep linking**: all routes must have URL-safe paths (no query-only routing) to support Capacitor deep links
- **CSP must include** `capacitor://localhost` and `ionic://localhost` in `default-src` and `connect-src`
- **Avoid `unsafe-eval`** in CSP when possible — Apple App Store review flags it. Current exception: Three.js WASM (tracked as TODO)
- **Touch targets**: minimum 44×44px for all interactive elements (Apple HIG requirement)
- **Network awareness**: handle offline/slow network gracefully — show cached data or offline indicators, never blank screens

## Environment Variables
- All env vars documented in `.env.example`
- Client-side env vars MUST be prefixed with `NEXT_PUBLIC_`
- Server-only secrets (service role keys, API keys) MUST NEVER have `NEXT_PUBLIC_` prefix

## Command Safety
- The following CLI tools are **approved for auto-run** without user confirmation:
  - `npm`, `npx`, `pnpm` — package management and script execution
  - `node`, `tsc`, `eslint` — runtime, type checking, linting
  - `git` — version control operations
  - `turbo` — monorepo task runner
  - `az` — Azure CLI for deployments
  - `next` — Next.js CLI (dev, build, start)
  - `wrangler` — Cloudflare/API deployment
- These are non-destructive development tools used daily in this project
- **Browser navigation** to `localhost`, `127.0.0.1`, and `jpx.nu` is always safe and approved
- Still exercise caution with `rm`, `del`, `format`, or any command that deletes data
