# Follow-Up Items

Living document of code improvements, tech debt, and quality issues. Continuously updated during development.
Items are categorized by priority and area. Resolved items move to the bottom.

---

## MEDIUM — Code Quality

- [ ] **`analyzeForm` tool not factory-wrapped** — `tools/index.ts:61` imports differently from all other tools. Inconsistent pattern
- [ ] **Oversized components** — `Body3DViewer.tsx` (662 lines), `training/page.tsx` (536 lines), `coach/page.tsx` (461 lines). Extract sub-components
- [ ] **Duplicate fatigue-to-color logic** — `MuscleDetail.tsx:38-55` (`statusBadge`) and `Body3DViewer.tsx:80-84` (`getFatigueTheme`). Extract to shared utility
- [ ] **Duplicate profile name formatting** — `dashboard/page.tsx:26-29` and `layout.tsx:63-67` both split display name. Extract helper

## MEDIUM — Performance

- [ ] **Memory deduplication is O(n²)** — `memory-extractor.ts:115-127` loops existing embeddings for each candidate. Batch embedding queries
- [ ] **Embedding vector oversized** — `00003` migration uses `vector(2000)` but Azure text-embedding-3-small is 1536 dims. Wasted storage

## MEDIUM — Accessibility

- [ ] **Generic alt text** — coach image attachments use `alt="Attachment"` (`coach/page.tsx:111-120`). Describe content

## LOW — Code Smells & Cleanup

- [ ] **console.error in use-coach.ts:165** — Will be resolved by Phase 6 AI SDK migration
- [ ] **packages/api-client unused** — Package exists but never imported by any consumer. Wire up or remove
- [ ] **TypeScript target inconsistency** — API: ES2024, Web: ES2017, Core: ES2022. Align
- [ ] **Missing `sourceMap` in api-client tsconfig** — Has declaration/declarationMap but no sourceMap
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
