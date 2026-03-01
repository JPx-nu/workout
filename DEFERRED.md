# Deferred Items — Migration Plan

Items intentionally skipped during the major migration work. Address these after all phases are complete.

## Type Consolidation

- **`apps/web/src/lib/types.ts` duplication**: This file defines camelCase frontend types (`Workout`, `DailyLog`, `HealthSnapshot`, `MuscleFatigue`, etc.) that overlap with `@triathlon/types` (snake_case DB types) and `@triathlon/core` (mappers + stats types). Currently both are used — web components import from `@/lib/types`, hooks now import from `@triathlon/core`. Consolidate into a single source of truth:
  - Move `Workout` (camelCase) type to `@triathlon/core` as `MappedWorkout` (already done)
  - Move `HealthSnapshot`, `MuscleFatigue`, `FatigueLevel`, `DailyLog` to `@triathlon/core` (already exported, but web's `types.ts` still has its own copies)
  - Move `ChartDataPoint`, `WeeklyStats` to `@triathlon/core` (already exported)
  - Keep AI-specific types (`Message`, `Conversation`, `suggestedPrompts`) in web or move to `@triathlon/types`
  - Keep strength UI types (`StrengthSet`, `StrengthExercise`, `StrengthSessionData`) — decide if they belong in `@triathlon/types` or `@triathlon/core`
  - Remove `defaultFatigueData` demo constant (only used by body-map-3d page)
  - Update ~12 component imports from `@/lib/types` → `@triathlon/core`
- **`StrengthMetrics` type duplication**: Defined locally in both `apps/web/src/hooks/use-workouts.ts` and `apps/web/src/app/dashboard/components/strength-view.tsx`. Extract to `@triathlon/core` alongside the `computeStrengthMetrics` function.

## Route Conversion to OpenAPI

- **Incremental `createRoute()` migration**: Phase 3 migrated the server to `OpenAPIHono` and added `/api/doc` + `/api/reference`, but individual route files still use plain handler functions (not `createRoute()` definitions). Converting each route to `createRoute()` with request/response schemas would produce a richer OpenAPI spec. Do this incrementally:
  - `apps/api/src/routes/planned-workouts/index.ts` — 5 endpoints
  - `apps/api/src/routes/integrations/*.ts` — OAuth + status endpoints
  - `apps/api/src/routes/ai/chat.ts` — SSE streaming endpoint
  - `apps/api/src/routes/webhooks/index.ts` — webhook endpoints

## OAuth Callback Deduplication

- **Near-identical OAuth callback implementations**: `strava.ts`, `polar.ts`, and `wahoo.ts` each have ~30 lines of nearly identical OAuth callback logic (extract code/state/error from query, call `verifyCallbackState`, look up `club_id`, call `handleOAuthCallback`, redirect). Extract into a shared `handleProviderCallback(provider, c)` helper in `services/integrations/oauth.ts` to reduce the 3 copies to 1.

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

- **`apps/web/src/hooks/use-profile.ts:100,129`**: Two `console.error` calls for profile update failures. Should use a proper error reporting mechanism (e.g., toast notification or error state). Not replaced with Pino since the web app doesn't use server-side logging.
- **`apps/web/src/hooks/use-coach.ts`**: Contains `console.error` calls for SSE parsing failures. Will be resolved by Phase 6 (AI SDK migration).

## In-Memory Sync Cooldowns

- **Provider-level cooldowns**: `strava.ts`, `polar.ts`, `wahoo.ts` each have in-memory `syncCooldown` Maps. These use the shared `INTEGRATION_CONFIG.syncCooldownMs` constant now, but still lose state on server restart. Consider moving to the DB-backed `check_rate_limit()` function (already exists from Phase 8) or keeping as-is (they only affect the current instance and are a minor concern).

## Database Cleanup Jobs

- **Periodic cleanup**: The migration `00016_add_queue_and_rate_limit.sql` created `cleanup_webhook_queue()` and `cleanup_rate_limits()` PostgreSQL functions but no pg_cron schedule. When pg_cron is available in production, add:
  ```sql
  SELECT cron.schedule('cleanup-webhook-queue', '0 3 * * *', 'SELECT public.cleanup_webhook_queue()');
  SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', 'SELECT public.cleanup_rate_limits()');
  ```

## packages/shared

- **`packages/shared/`**: Directory exists but appears to be empty or unused. Either add a proper `package.json` with `@triathlon/shared` name, or delete the directory entirely.

## Demo Credentials in Login Page

- **Hardcoded demo credentials**: The login page likely contains hardcoded demo email/password for development convenience. These should be gated behind `NODE_ENV === 'development'` or removed entirely before production deployment.

---

## Recently Resolved

_Items moved here after being addressed._

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
