# Deferred Items — Migration Plan

Items intentionally skipped during the major migration work. Address these after all phases are complete.

## Route Conversion to OpenAPI

- **Incremental `createRoute()` migration**: Phase 3 migrated the server to `OpenAPIHono` and added `/api/doc` + `/api/reference`, but individual route files still use plain handler functions (not `createRoute()` definitions). Converting each route to `createRoute()` with request/response schemas would produce a richer OpenAPI spec. Do this incrementally:
  - `apps/api/src/routes/planned-workouts/index.ts` — 5 endpoints
  - `apps/api/src/routes/integrations/*.ts` — OAuth + status endpoints
  - `apps/api/src/routes/ai/chat.ts` — SSE streaming endpoint
  - `apps/api/src/routes/webhooks/index.ts` — webhook endpoints

## Unused packages/api-client

- **`packages/api-client/`**: Package exists with `hc<AppType>()` wrapper but is not imported by any consumer (`apps/web` still uses raw `fetch()`). Either:
  - Wire it into the web app's data-fetching hooks (replacing manual fetch calls), or
  - Wire it into the mobile app when Phase 5 begins, or
  - Remove it if the RPC client approach is deferred

## Web Hook Adapter Pattern

- **Platform adapter interfaces**: The plan called for `AuthAdapter` and `StorageAdapter` interfaces in `packages/core` to abstract platform-specific code (browser vs mobile). Currently hooks import `useAuth` and `createClient` directly. Once mobile (Phase 5) starts, create:
  - `packages/core/src/adapters/auth.ts` — `AuthAdapter` interface
  - `packages/core/src/adapters/storage.ts` — `StorageAdapter` interface
  - Web implementations in `apps/web/src/lib/adapters/`
  - Mobile implementations in `apps/mobile/lib/adapters/`

## useCoach Hook Extraction

- **`apps/web/src/hooks/use-coach.ts`** (429 lines): Heavily browser-dependent (URL.createObjectURL, AbortController, TextDecoder for SSE). The SSE parsing logic (~108 lines) could be extracted to `@triathlon/core/streaming`, but this is better addressed during Phase 6 (AI SDK migration) when `useChat` from `@ai-sdk/react` will replace the manual SSE parsing entirely.

## Console Calls in Web

- **`apps/web/src/hooks/use-coach.ts`**: Contains `console.error` calls for SSE parsing failures. Will be resolved by Phase 6 (AI SDK migration).

---

## Recently Resolved

_Items moved here after being addressed._

- ~~**Type consolidation (`@/lib/types` → `@triathlon/core` + `@triathlon/types`)**~~ — Moved `Workout`, `DailyLog`, `HealthSnapshot`, `MuscleFatigue`, `ChartDataPoint`, `WeeklyStats` imports to `@triathlon/core`; moved `StrengthSet`, `StrengthExercise`, `StrengthSessionData`, `MuscleGroup` to `@triathlon/types/strength`; slimmed `types.ts` from 183 → ~85 lines; updated 10 consumer files (2026-03-01)
- ~~**`StrengthMetrics` type duplication**~~ — Extracted `StrengthMetrics` type + `computeStrengthMetrics()` function to `@triathlon/core/strength`; removed local copies from `use-workouts.ts` and `strength-view.tsx` (2026-03-01)
- ~~**OAuth callback deduplication**~~ — Extracted `handleProviderOAuthCallback()` to `oauth.ts`; strava/polar/wahoo routes now call shared handler (128→42, 114→38, 109→38 lines) (2026-03-01)
- ~~**In-memory sync cooldowns**~~ — Extracted `handleProviderSync()` to `oauth.ts` using DB-backed `check_rate_limit()` RPC; removed in-memory `syncCooldown` Maps from all 3 provider routes (2026-03-01)
- ~~**Database cleanup jobs**~~ — Added `00017_add_cleanup_cron_schedules.sql` migration scheduling `cleanup_webhook_queue()` daily at 03:00 UTC and `cleanup_rate_limits()` every 5 minutes via pg_cron (2026-03-01)
- ~~**Demo credentials in login page**~~ — Gated behind `NEXT_PUBLIC_ENABLE_DEMO` env var; demo button and handler only active when explicitly enabled (2026-03-01)
- ~~**Console.error in use-profile.ts**~~ — Removed 2 redundant `console.error` calls (throws already bubble to caller) (2026-03-01)
- ~~**packages/shared reference**~~ — Removed stale DEFERRED.md entry (directory doesn't exist) (2026-03-01)
- ~~**Hardcoded Supabase URL fallback** in `auth.ts`~~ — Removed; now throws if `SUPABASE_URL` env var missing (2026-03-01)
- ~~**`@azure/mcp` unused dependency**~~ — Removed from root `package.json` (2026-03-01)
- ~~**`PlannedWorkoutStatus` enum mismatch**~~ — Added "cancelled" to match DB; deduplicated enums in `validation.ts` (2026-03-01)
- ~~**Duplicated activity metadata** across 3 web views~~ — Consolidated into `apps/web/src/lib/activity-config.ts` (2026-03-01)
- ~~**Duplicated API URL constants** across web hooks~~ — Consolidated into `apps/web/src/lib/constants.ts` (2026-03-01)
- ~~**Duplicated sync cooldown / web URL constants** across 3 integration routes~~ — Consolidated into `INTEGRATION_CONFIG` (2026-03-01)
- ~~**Stale eslint-disable comments**~~ — Removed from `use-health.ts`, `use-training.ts`, `Body3DViewer.tsx` (2026-03-01)
- ~~**Backward-compat re-exports in `use-workouts.ts`**~~ — Removed; consumers import directly from `@triathlon/core` (2026-03-01)
- ~~**Flutter references in deploy.yml**~~ — Removed Flutter SDK setup, build step, and bundling (2026-03-01)
- ~~**Webpack `.js` extension resolution for workspace packages**~~ — Fixed with `transpilePackages` + `extensionAlias` in `next.config.ts` (2026-03-01)
