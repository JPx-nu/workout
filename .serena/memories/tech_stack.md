# Tech Stack

| Layer | Stack |
|-------|-------|
| Web framework | Next.js 16 App Router, React 19, React Compiler |
| Styling | Tailwind CSS v4 |
| API framework | Hono (Zod OpenAPI) |
| AI orchestration | LangGraph + Azure OpenAI, Vercel AI SDK 6 on client |
| Auth | Supabase (JWKS via jose) |
| Database | Supabase PostgreSQL |
| Testing | Vitest (API/packages), Playwright (web e2e) |
| Linting/formatting | Biome (NOT ESLint/Prettier) |
| PWA | Serwist |
| Observability | OpenTelemetry, Pino |
| Package manager | pnpm@10.29.2 |
| Task runner | Turbo |
| Node version | 24.x |
| Deploy | Azure App Service (API first, health-gated, then web) |