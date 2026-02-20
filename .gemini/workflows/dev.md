---
description: How to run the development environment and common development tasks
---

// turbo-all

## Start Dev Environment

1. Start all services (web + api) from the monorepo root:
```bash
npm run dev
```

## Common Tasks

2. Install a dependency in a specific workspace:
```bash
pnpm --filter web add <package>
```

3. Run type checking:
```bash
pnpm --filter web tsc --noEmit
```

4. Run linting:
```bash
pnpm --filter web run lint
```

5. Run production build (with webpack for Serwist):
```bash
pnpm --filter web run build
```
