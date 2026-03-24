# Suggested Commands

## Development
```bash
pnpm install                           # install all workspaces
pnpm dev                               # start all apps via turbo
pnpm --filter web dev                  # web only (port 3100)
pnpm --filter @triathlon/api dev       # API only (port 8787)
```

## Linting & Type-checking (Husky pre-commit runs both)
```bash
pnpm lint                              # biome check + web public env access guard
pnpm type-check                        # turbo type-check across all workspaces
pnpm format                            # biome format --write
```

## Testing
```bash
pnpm test                              # all workspace tests via turbo
pnpm --filter @triathlon/api test      # API unit tests (vitest)
pnpm --filter @triathlon/core test     # core package tests
pnpm --filter @triathlon/types test    # types package tests
```

## E2E
```bash
pnpm --filter @triathlon/api test:e2e  # API e2e (vitest, separate config)
pnpm --filter web test:e2e             # Playwright browser tests (auto-starts local stack)
```

## Single Test File
```bash
cd apps/api && npx vitest run src/__tests__/my-test.test.ts
cd apps/api && npx vitest run --config vitest.e2e.config.ts src/__e2e__/my-test.e2e.ts
```

## Build
```bash
pnpm build                             # all workspaces
pnpm --filter web build                # web (validates routes/config/env)
pnpm --filter @triathlon/api build:deploy  # API deploy bundle -> dist-deploy/
```

## Env Consistency
```bash
pnpm check:env-keys                    # validates env keys across .env.example, startup-env, deploy workflow
```

## System Utilities (Windows with bash shell)
```bash
git status / git log / git diff        # git operations
ls / find / grep                       # file operations (bash on Windows)
```