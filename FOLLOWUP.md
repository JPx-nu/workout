# Follow-Up Items

Living document of code improvements, tech debt, and quality issues. Continuously updated during development.
Items are categorized by priority and area. Resolved items move to the bottom.

---

## HIGH — Security & Data Integrity

- [ ] **Hardcoded test credentials** — `test-ai.ts:24`, `create-test-user.ts:17` have plaintext passwords. Gate behind env var or move to `.env.test`
- [ ] **CORS localhost too permissive** — `server.ts:41` allows any localhost port. Restrict to known dev ports (3000, 3001)
- [ ] **RLS gap: planned_workouts** — SELECT only checks `athlete_id`, not `club_id`. Coaches can't see athletes' plans. Align with club-based RLS pattern from `00005`
- [ ] **Missing FK indexes** — `training_plans.event_id`, `planned_workouts.workout_id` lack indexes. Slow JOINs
- [ ] **Missing RLS query indexes** — `conversations(athlete_id)`, `messages(conversation_id)` used in RLS subqueries but no index. O(n) per request
- [ ] **Prompt injection via profile data** — `prompts/prompt.ts:20-26` injects `display_name`, `timezone` raw into system prompt. Escape or sanitize
- [ ] **Prompt injection via memory content** — `prompts/prompt.ts:45` injects user-controlled memory content without escaping

## HIGH — Reliability & Error Handling

- [ ] **No Azure OpenAI retry/backoff** — All embedding + LLM calls fail immediately on 429. Add exponential backoff or circuit breaker
- [ ] **No LLM call timeout** — `graph.ts:101-110` AzureChatOpenAI has no timeout. Could hang indefinitely
- [ ] **Reflection node acceptance check is brittle** — `graph.ts:157` matches `"ACCEPT"` string; `"NOT ACCEPT"` would incorrectly pass
- [ ] **Blob URL memory leak** — `coach/page.tsx:248` calls `URL.createObjectURL()` but never `revokeObjectURL()` on cleanup

## MEDIUM — Code Quality

- [ ] **Embeddings factory duplicated 6x** — `graph.ts:66`, `log-workout.ts:100`, `save-memory.ts:23`, `match-documents.ts:17`, `search-workouts.ts:17`, `memory-extractor.ts:62`. Extract to shared factory
- [ ] **3 `as any` in AI tool RPC responses** — `match-documents.ts:46`, `traverse-graph.ts:31`, `search-workouts.ts:46`. Type the RPC return shapes
- [ ] **Webhook route handlers duplicated** — `webhooks/index.ts:46-116` has 4 near-identical POST handlers. Use factory function
- [ ] **Date string formatting duplicated** — `toISOString().split("T")[0]` appears in 4+ AI tools. Extract to utility
- [ ] **Magic numbers in AI layer** — cosine similarity 0.88 (`memory-extractor.ts:126`), ACWR thresholds 0.8/1.3/1.5 (`predict-injury-risk.ts:33,52`), confidence 0.6 (`safety.ts:156`). Extract to named constants
- [ ] **Hardcoded Azure API version in 2 places** — `ai.ts:23` and `generate-workout-plan.ts:109`. Single source of truth
- [ ] **`analyzeForm` tool not factory-wrapped** — `tools/index.ts:61` imports differently from all other tools. Inconsistent pattern
- [ ] **Oversized components** — `Body3DViewer.tsx` (662 lines), `training/page.tsx` (536 lines), `coach/page.tsx` (461 lines). Extract sub-components
- [ ] **Duplicate fatigue-to-color logic** — `MuscleDetail.tsx:38-55` (`statusBadge`) and `Body3DViewer.tsx:80-84` (`getFatigueTheme`). Extract to shared utility
- [ ] **Duplicate profile name formatting** — `dashboard/page.tsx:26-29` and `layout.tsx:63-67` both split display name. Extract helper

## MEDIUM — Performance

- [ ] **Missing memoization in dashboard views** — `strength-view.tsx:20-41` (chartData), `triathlon-view.tsx:76-106` (statCards) created on every render. Wrap in `useMemo`
- [ ] **Memory deduplication is O(n²)** — `memory-extractor.ts:115-127` loops existing embeddings for each candidate. Batch embedding queries
- [ ] **Unbounded planned workouts query** — `planned-workouts/index.ts:46` has no LIMIT. Add pagination
- [ ] **sync-history limit not validated** — `integrations/index.ts:59-60` parses `parseInt()` without bounds. Cap at 100
- [ ] **Embedding vector oversized** — `00003` migration uses `vector(2000)` but Azure text-embedding-3-small is 1536 dims. Wasted storage

## MEDIUM — Accessibility

- [ ] **Missing aria-labels** — body map toggle buttons (`BodySvg.tsx:76-95`), training view switcher (`training/page.tsx:252-269`)
- [ ] **Generic alt text** — coach image attachments use `alt="Attachment"` (`coach/page.tsx:111-120`). Describe content
- [ ] **Modal not keyboard-accessible** — `coach/page.tsx:339-348` overlay uses `role="presentation"` with onClick. Use `<dialog>` pattern
- [ ] **Missing error boundaries** — dashboard layout has no error boundary around children. Add per-section boundaries

## LOW — Code Smells & Cleanup

- [ ] **console.log in sw-register.tsx** — Lines 11, 14. Replace with conditional debug logging
- [ ] **console.error in use-coach.ts:165** — Will be resolved by Phase 6 AI SDK migration
- [ ] **packages/api-client unused** — Package exists but never imported by any consumer. Wire up or remove
- [ ] **Unused types in @triathlon/types** — `RaceDistanceType`, `KGEntityType`, `KGRelationship` not used in app code
- [ ] **TypeScript target inconsistency** — API: ES2024, Web: ES2017, Core: ES2022. Align
- [ ] **Missing `sourceMap` in api-client tsconfig** — Has declaration/declarationMap but no sourceMap
- [ ] **Turbo.json missing task outputs** — No caching for `type-check`, `test`, `lint` tasks
- [ ] **PlannedWorkoutRow too loose** — `mappers.ts:115` uses `Record<string, unknown>`. Define explicit type
- [ ] **Duplicate DataSource definitions** — String union in `index.ts:9-16` vs Zod enum in `validation.ts:35-43`. Single source of truth
- [ ] **Missing EnvSchema type export** — `validation.ts:147` defines schema but no `z.infer<typeof EnvSchema>` export
- [ ] **Hardcoded emojis in schedule-workout** — `schedule-workout.ts:74-81` emoji map. Move to config constant
- [ ] **test-ai.ts has `as any` casts** — Lines 94-99. Type properly or remove test file

## Deferred to Future Phases

- [ ] **Route conversion to OpenAPI `createRoute()`** — Individual routes still use plain handlers. Convert incrementally → Phase 6/7
- [ ] **Wire `packages/api-client` into consumers** — No consumer exists yet → Phase 5 (Expo) or Phase 6
- [ ] **Platform adapter interfaces (Auth/Storage)** — Needed when mobile app starts → Phase 5
- [ ] **useCoach hook extraction to core** — Will be replaced by AI SDK `useChat` → Phase 6
- [ ] **use-coach.ts console calls** — Entire hook gets rewritten → Phase 6

---

## Recently Resolved

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
