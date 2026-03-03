# Follow-Up Items

Living document of code improvements, tech debt, and quality issues. Continuously updated during development.
Items are categorized by priority and area. Resolved items move to the bottom.

---

## MEDIUM — Code Quality

- [ ] **Oversized components** — `Body3DViewer.tsx` (661 lines), `training/page.tsx` (539 lines), `coach/page.tsx` (461 lines). Extract sub-components → Phase 7
- [ ] **Duplicate fatigue-to-color logic** — `body-map/MuscleDetail.tsx:38-55` (`statusBadge` → CSS) and `body-map-3d/Body3DViewer.tsx:80-84` (`getFatigueTheme` → THREE.Color). Different rendering contexts but same threshold logic — extract shared `getFatigueLevel()` function
- [ ] **Web-side duplicate patterns** — Duplicate fetch patterns in hooks, repeated inline styles, duplicate stat card patterns, icon wrapper duplication, date formatting duplication → Phase 7
- [ ] **generate-workout-plan.ts bypasses service layer** — Makes raw Supabase calls instead of using `getProfile()`, `getWorkouts()` from `services/ai/supabase.ts`. Should be refactored for consistency

## MEDIUM — Performance

- [ ] **Memory deduplication is O(n²)** — `memory-extractor.ts:115-127` loops existing embeddings for each candidate. Small in practice (3×20) but could batch cosine similarity via pgvector
- [ ] **Embedding vector oversized** — `00003` migration uses `vector(2000)` but Azure text-embedding-3-small produces 1536 dims. Needs ALTER COLUMN migration

## LOW — Code Smells & Cleanup

- [ ] **packages/api-client unused** — Package exists but never imported by any consumer. Wire up in Phase 5 (Expo) or remove
- [ ] **TypeScript target inconsistency** — API: ES2024, Web: ES2017, Core: ES2022. Align when practical

## Deferred to Future Phases

- [ ] **Route conversion to OpenAPI `createRoute()`** — Individual routes still use plain handlers. Convert incrementally → Phase 7
- [ ] **Wire `packages/api-client` into consumers** — No consumer exists yet → Phase 5 (Expo)
- [ ] **Platform adapter interfaces (Auth/Storage)** — Needed when mobile app starts → Phase 5

---

## Recently Resolved

- ~~3 duplicate `getSupabase()` admin client~~ — Replaced with `createAdminClient()` from `services/ai/supabase.ts` in onboarding.ts, planned-workouts/index.ts, rate-limit.ts (2026-03-02)
- ~~4 duplicate JWT extractions~~ — Added `getJwt(c)` helper to auth middleware, updated chat.ts, stream.ts, mcp/index.ts (2026-03-02)
- ~~Duplicate agent error handlers~~ — Extracted `isGraphRecursionError`, `isAbortError`, `getAgentErrorMessage` to `services/ai/utils/agent-errors.ts` (2026-03-02)
- ~~Duplicate session load calculation~~ — Added `estimateSessionLoad()` to `@triathlon/core`, used in analyze-workouts + predict-injury-risk (2026-03-02)
- ~~Duplicate biometric averaging~~ — Added `computeAverage()` to `@triathlon/core`, used in analyze-biometric-trends + get-progress-report (2026-03-02)
- ~~Manual date math in 3 tools~~ — Standardized to `lookbackDate()` from `@triathlon/core` in analyze-workouts, analyze-biometric-trends, predict-injury-risk (2026-03-02)
- ~~Duplicate squad membership queries~~ — Added `getUserSquadIds()` to `services/ai/supabase.ts`, used in get-squad-leaderboard + pass-baton (2026-03-02)
- ~~Azure OpenAI API inconsistency (endpoint vs instanceName)~~ — Standardized all 4 sites to `azureOpenAIApiInstanceName` via `getAzureInstanceName()` helper (2026-03-02)
- ~~No MCP server for external agents~~ — Added `/mcp` endpoint with `WebStandardStreamableHTTPServerTransport`, bridges all 21 LangChain tools to MCP protocol (2026-03-02)
- ~~`analyzeForm` not factory-wrapped~~ — Wrapped in `createAnalyzeFormTool()` factory for barrel export consistency (2026-03-02)
- ~~Missing EnvSchema type export~~ — Added `export type EnvSchema = z.infer<typeof EnvSchema>` to `validation.ts` (2026-03-02)
- ~~Hardcoded emojis in schedule-workout~~ — Moved to `AI_CONFIG.activityEmoji` in `config/ai.ts` (2026-03-02)
- ~~Generic alt text on coach image attachments~~ — Changed `alt="Attachment"` to role-aware alt text (2026-03-02)
- ~~console.error in use-coach.ts~~ — Removed both `console.error` calls (load conversation + upload error) (2026-03-02)
- ~~Missing `sourceMap` in api-client tsconfig~~ — Already present; stale reference (2026-03-02)
- ~~Duplicate profile name formatting~~ — No longer duplicated after layout refactoring; stale reference (2026-03-02)
- ~~test-ai.ts `as any` casts~~ — Casts are now typed `as Array<{...}>`, not raw `as any`; acceptable (2026-03-02)
- ~~Duplicate DataSource definitions~~ — Zod schema in `validation.ts` is now single source of truth, TS type derived via `z.infer` (2026-03-01)
- ~~PlannedWorkoutRow too loose~~ — `mappers.ts` now has explicit 23-field interface matching DB schema (2026-03-01)
- ~~Turbo.json missing task outputs~~ — Added `inputs` arrays for `lint` and `type-check` tasks (2026-03-01)
- ~~Unused types in @triathlon/types~~ — Removed `RaceDistanceType`, `KGEntityType`, `KGRelationship` (2026-03-01)
- ~~console.log in sw-register.tsx~~ — Removed console.log/warn, silent catch (2026-03-01)
- ~~Missing error boundaries~~ — Added `ErrorBoundary` component, wrapped dashboard layout (2026-03-01)
- ~~Missing aria-labels~~ — Added to body map toggles, training view switcher, and nav chevrons (2026-03-01)
- ~~sync-history limit not validated~~ — Capped at 1–100 with `Math.min(Math.max(...))` (2026-03-01)
- ~~Unbounded planned workouts query~~ — Added `.limit(200)` to planned workouts GET (2026-03-01)
- ~~Missing memoization in dashboard views~~ — Wrapped `chartData` and `statCards` in `useMemo` (2026-03-01)
- ~~Hardcoded Azure API version~~ — Both files now use `AI_CONFIG.azure.*` (2026-03-01)
- ~~Magic numbers in AI layer~~ — Extracted to `AI_CONFIG.thresholds` and `AI_CONFIG.safety` (2026-03-01)
- ~~Date string formatting duplicated~~ — 17 occurrences replaced with `toIsoDate()` / `lookbackDate()` from `@triathlon/core` (2026-03-01)
- ~~Webhook route handlers duplicated~~ — Extracted into `registerSimpleWebhook()` factory (2026-03-01)
- ~~3 `as any` in AI tool RPC responses~~ — Added `MatchDocumentRow`, `MatchWorkoutRow`, `GraphNodeRow` interfaces (2026-03-01)
- ~~Embeddings factory duplicated 6x~~ — Extracted to `services/ai/utils/embeddings.ts`, all 6 consumers updated (2026-03-01)
- ~~Blob URL memory leak~~ — Added `URL.revokeObjectURL()` cleanup in coach page (2026-03-01)
- ~~Reflection node acceptance check brittle~~ — Changed to `/^\s*ACCEPT/i.test()` (2026-03-01)
- ~~No LLM call timeout~~ — Added `timeout: 60000` to AzureChatOpenAI (2026-03-01)
- ~~No Azure OpenAI retry/backoff~~ — Added `maxRetries: 3` + `timeout` to LLM and embeddings (2026-03-01)
- ~~Prompt injection via memory content~~ — `sanitizeForPrompt()` applied to memory content in system prompt (2026-03-01)
- ~~Prompt injection via profile data~~ — `sanitizeForPrompt()` strips control chars, HTML, and template patterns (2026-03-01)
- ~~Missing RLS query indexes~~ — Added indexes on `conversations(athlete_id)`, `messages(conversation_id)` (2026-03-01)
- ~~Missing FK indexes~~ — Added indexes on `training_plans(event_id)`, `planned_workouts(workout_id)` (2026-03-01)
- ~~RLS gap: planned_workouts~~ — Added coach/admin SELECT policy with club-based access (2026-03-01)
- ~~CORS localhost too permissive~~ — Restricted to ports 3000, 3001, 8787 (2026-03-01)
- ~~Hardcoded test credentials~~ — Moved to env vars `TEST_EMAIL`/`TEST_PASSWORD` (2026-03-01)
- ~~Stale pnpm-lock.yaml (CI failure)~~ — regenerated after `@azure/mcp` removal (2026-03-01)
- ~~`.env.azure.json` not in `.gitignore`~~ — added to `.gitignore` (2026-03-01)
- ~~Strava verify token default fallback~~ — removed hardcoded fallback from `integrations.ts` (2026-03-01)
- ~~PlannedWorkoutStatus DB/schema mismatch~~ — added `00018_add_cancelled_status.sql` migration (2026-03-01)
- ~~PII redaction dead code~~ — removed `piiRedacted` field from interface + all consumers (2026-03-01)
- ~~Unused `pg` devDependency~~ — removed from `apps/api/package.json` (2026-03-01)
- ~~Validate middleware swallows all errors~~ — now only catches `SyntaxError` (2026-03-01)
- ~~Biome checking `.claude/` settings files~~ — excluded via `!.claude` in `biome.json` (2026-03-01)
- ~~Type consolidation (`@/lib/types` → `@triathlon/core` + `@triathlon/types`)~~ (2026-03-01)
- ~~StrengthMetrics type duplication~~ (2026-03-01)
- ~~OAuth callback deduplication~~ (2026-03-01)
- ~~In-memory sync cooldowns → DB-backed rate limit~~ (2026-03-01)
- ~~Database cleanup cron schedules (pg_cron)~~ (2026-03-01)
- ~~Demo credentials gated behind env var~~ (2026-03-01)
- ~~console.error in use-profile.ts~~ (2026-03-01)
- ~~packages/shared stale reference~~ (2026-03-01)
- ~~Hardcoded Supabase URL fallback in auth.ts~~ (2026-03-01)
- ~~@azure/mcp unused dependency~~ (2026-03-01)
- ~~PlannedWorkoutStatus enum mismatch (partial — types fixed, DB migration pending)~~ (2026-03-01)
- ~~Duplicated activity metadata → activity-config.ts~~ (2026-03-01)
- ~~Duplicated API URL constants → constants.ts~~ (2026-03-01)
- ~~Duplicated sync cooldown/web URL → INTEGRATION_CONFIG~~ (2026-03-01)
- ~~Stale eslint-disable comments~~ (2026-03-01)
- ~~Backward-compat re-exports in use-workouts.ts~~ (2026-03-01)
- ~~Flutter references in deploy.yml~~ (2026-03-01)
- ~~Webpack .js extension resolution~~ (2026-03-01)
