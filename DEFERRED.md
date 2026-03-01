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

## Route Conversion to OpenAPI

- **Incremental `createRoute()` migration**: Phase 3 migrated the server to `OpenAPIHono` and added `/api/doc` + `/api/reference`, but individual route files still use plain handler functions (not `createRoute()` definitions). Converting each route to `createRoute()` with request/response schemas would produce a richer OpenAPI spec. Do this incrementally:
  - `apps/api/src/routes/planned-workouts/index.ts` — 5 endpoints
  - `apps/api/src/routes/integrations/*.ts` — OAuth + status endpoints
  - `apps/api/src/routes/ai/chat.ts` — SSE streaming endpoint
  - `apps/api/src/routes/webhooks/index.ts` — webhook endpoints

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

## In-Memory Sync Cooldowns

- **Provider-level cooldowns**: The plan mentioned removing in-memory sync cooldowns from `strava.ts:29`, `polar.ts:23`, `wahoo.ts:23`. These are separate from the webhook queue — they prevent rapid duplicate sync requests. Consider moving to a DB-backed cooldown mechanism or keeping as-is (they only affect the current instance).

## Database Cleanup Jobs

- **Periodic cleanup**: The migration `00016_add_queue_and_rate_limit.sql` created `cleanup_webhook_queue()` and `cleanup_rate_limits()` PostgreSQL functions but no pg_cron schedule. When pg_cron is available in production, add:
  ```sql
  SELECT cron.schedule('cleanup-webhook-queue', '0 3 * * *', 'SELECT public.cleanup_webhook_queue()');
  SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *', 'SELECT public.cleanup_rate_limits()');
  ```

## packages/shared

- **`packages/shared/`**: Directory exists but appears to be empty or unused. Either add a proper `package.json` with `@triathlon/shared` name, or delete the directory entirely.
