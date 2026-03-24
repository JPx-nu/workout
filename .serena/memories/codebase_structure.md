# Codebase Structure

```
triathlon-app/
├── apps/
│   ├── web/              # Next.js 16 + React 19 frontend
│   │   └── src/          # App Router pages, components, hooks
│   ├── api/              # Hono API server
│   │   └── src/
│   │       ├── services/ai/tools/   # 21 AI agent tools
│   │       ├── services/workout-center.ts  # Shared workout write layer
│   │       └── server.ts            # API entry point
│   └── mobile/           # Flutter app (outside pnpm/Turbo)
├── packages/
│   ├── types/            # Shared Zod schemas, TypeScript contracts
│   ├── core/             # Shared pure logic (dates, stats, mapping, strength)
│   └── api-client/       # Typed Hono RPC client scaffold
├── docs/
│   ├── technical-reference.md  # Implementation truth
│   ├── integrations.md         # Provider contracts
│   └── web-v1-feature-matrix.md
├── scripts/              # Repo-level check scripts
├── CLAUDE.md             # Claude Code agent guidance
├── AGENTS.md             # General agent guidance
└── FOLLOWUP.md           # Living backlog / unresolved debt
```

## Key Guidance Files
- Root `AGENTS.md` + nested `AGENTS.md` files per subtree define folder-specific conventions.
- `CLAUDE.md` mirrors repo guidance for Claude-based agents.
- `.gemini/rules.md` and `.agent/workflows/*` for other agent clients.