# Follow-Up Items

Living backlog of implementation debt and sequencing.

Last updated: 2026-03-25

---

## High Priority

- [ ] **Garmin integration completion plan**
      OAuth 1.0a flow and webhook verification are still partial/stubbed in provider + route layer.

- [ ] **Webhook provider signature parity**
      Strava has structural payload validation (not signed payloads); Garmin currently accepts all events pending approval flow.

---

## Medium Priority

- [ ] **Refactor large web components**
      `apps/web/src/components/body-map-3d/Body3DViewer.tsx` remains very large and mixes rendering/state logic.

- [ ] **Tool/service consistency cleanup**
      `generate-workout-plan` still bypasses shared service helpers in places; align with `services/ai/supabase.ts` patterns.

- [ ] **Memory extraction dedup cost**
      Current cosine dedup compares candidate embeddings against in-memory vectors (O(n*m)); evaluate DB-side vector similarity for scale.

- [ ] **`@triathlon/api-client` adoption**
      Package exists but is not consumed by web/mobile. Either integrate intentionally or remove.

---

## Pre-Test/Freeze Cleanup (Recommended Before New Tests)

- [ ] **Demo auth claims verification pass**
      Ensure all beta/demo users are issued JWTs with valid `app_metadata.club_id` + `app_metadata.role` after strict claim enforcement.

- [ ] **Rollout check for migration `00021`**
      Confirm migration ordering and rollback notes for new `external_id` unique indexes before schema freeze.

- [ ] **Optional legacy backfill decision**
      Decide whether to backfill `external_id` for historical `workouts`/`health_metrics` rows or keep idempotency enforced only for newly ingested mobile records.

---

## Mobile Health Ecosystem Priority (iOS + Android)

1. **Permissions and consent foundation**
   - Implement platform-specific consent UX for Apple HealthKit and Android Health Connect.
   - Persist granted scopes and show clear connected/partially connected/not connected states.
2. **Read-only health ingestion (MVP)**
   - Pull core metrics first: sleep duration, resting HR, HRV, workouts.
   - Normalize and write into existing API/Supabase tables (`health_metrics`, `daily_logs`, `workouts`).
3. **Background sync and resilience**
   - Add periodic/background sync with retry and offline queueing.
   - Track last successful sync per source and expose status in settings.
4. **Source provenance and troubleshooting**
   - Surface data source labels (HealthKit/Health Connect/device) in UI.
   - Add diagnostics for permissions denied, stale sync, unsupported metric types.

---

## Documentation and Process

- [ ] **Legal copy review**
      Privacy/terms pages now match the current shipped product surface more closely, but they still need formal legal review before they should be treated as final legal text.

- [ ] **Finish Key Vault coverage for remaining provider/runtime secrets**
      Core API secrets now live in Key Vault and App Service reads them through managed identity, but remaining provider/runtime secrets should be audited and moved into the same pattern so the portal does not become a second source of truth again.

- [ ] **Dedicated published AI smoke-test account**
      The deploy workflow now exercises the published `/api/ai/stream` path; move it off the shared demo fallback to a dedicated low-privilege smoke-test user before tightening auth and demo access further.

---

## Conflicts Requiring Owner Confirmation

- [ ] **Mobile OAuth callback target policy**
      Current implementation allows only allowlisted `http(s)` `returnTo` URLs. Confirm if external beta should stay on HTTPS universal/app links only, or if custom-scheme deep links must be supported.

---

## Next-Step Plan

1. **Provider parity and webhook hardening**
   - Finalize Garmin pending-approval behavior and explicit support docs.
   - Tighten webhook verification paths and replay protection where provider payloads support identifiers.
2. **Mobile health integration (priority lane)**
   - Implement HealthKit/Health Connect permission UX and status mapping.
   - Build incremental read adapters and call `/api/health/ingest` with source-scoped idempotency keys.
3. **Reliability and observability**
   - Add mobile background sync scheduling (WorkManager + iOS background delivery/resume fallback).
   - Add telemetry for permission denial, stale sync, ingest validation failures, and rate-limit responses.
4. **Pre-freeze quality gates**
   - Add route-level integration tests for `/api/integrations/*` and `/api/health/ingest`.
   - Add mobile smoke checks for settings integration actions and ingest flow failure states.

---

## Detailed Beta/Demo Implementation Plan (Suggested Sequence)

Reference detail doc: `docs/external-beta-step1-3-plan.md` (source-backed tasks and acceptance gates for steps 1-3).

### Phase 1 - API hardening baseline (Week 1)

- Finalize env strictness matrix (local/demo/prod) and fail-fast behavior on missing critical keys.
- Complete webhook verification parity plan per provider (including explicit Garmin gap handling).
- Add structured error taxonomy for integration/auth failures (stable message + machine code).
- Exit criteria:
  - Staging boots with strict env checks.
  - All integration endpoints return documented error shapes.
  - `docs/technical-reference.md` and `docs/integrations.md` reflect final behavior.

### Phase 2 - Mobile integration UX and control plane (Week 1-2)

- Keep settings integration status live via `/api/integrations/status` (implemented).
- Add connect/disconnect/sync-now actions per provider from mobile settings.
- Add stale-sync indicators (`fresh`, `stale`, `never synced`) and user-facing remediation text.
- Exit criteria:
  - A user can start provider OAuth from mobile and see post-callback status update.
  - Queue depth and last-sync state are visible and understandable in settings.

### Phase 3 - Health ecosystem ingestion MVP (Week 2-3)

- Implement Apple HealthKit + Android Health Connect permission onboarding.
- Pull read-only core metrics: sleep duration, resting HR, HRV, workouts.
- Normalize and write into existing store (`health_metrics`, `daily_logs`, `workouts`) with source tags.
- Exit criteria:
  - At least one successful end-to-end sync path on iOS and Android test devices.
  - Data appears in body-map/dashboard flows without manual DB intervention.

### Phase 4 - Background sync and resilience (Week 3)

- Add periodic sync scheduler for mobile and retry strategy for transient failures.
- Persist local sync cursor and queued writes for offline/poor-network scenarios.
- Add telemetry for permission failures, stale cursor, and payload validation errors.
- Exit criteria:
  - Sync recovers after offline periods and app restarts.
  - Failures are observable via logs/metrics with actionable reasons.

### Phase 5 - Pre-freeze cleanup and tests (Week 4)

- Add route-level integration tests (`/api/ai/*`, `/api/planned-workouts/*`, `/api/integrations/*`).
- Add mobile smoke checks for settings status rendering and body-map severity mapping.
- Freeze schema-affecting changes unless migration-reviewed and rollback-ready.
- Exit criteria:
  - CI passes on targeted critical-path tests.
  - No P0/P1 defects remain in beta scope.

### Phase 6 - External beta/demo readiness (Week 4+)

- Prepare demo tenant seed data and role-complete JWT issuance.
- Run security and abuse-review checklist (rate limit behavior, auth claim coverage, webhook spoof checks).
- Publish operator runbook (known limitations, fallback paths, support triage flow).
- Exit criteria:
  - Demo script can be executed end-to-end without manual hotfixes.
  - Known limitations are documented and signed off.

---

## Recently Resolved (Condensed)

- Added a root `README.md` and refreshed implementation-truth docs (`docs/technical-reference.md`, `docs/integrations.md`, `docs/web-v1-feature-matrix.md`).
- Added explicit repo guidance to keep docs in sync with route/env/product-surface changes.
- Canonicalized env schema to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for web clients.
- Confirmed `/api/doc` and `/api/reference` stay JWT-protected for now.
- Added API startup env validation for critical + optional feature groups.
- Added CI env-key consistency check (`pnpm check:env-keys`).
- Enforced strict JWT custom claims (`app_metadata.club_id`, `app_metadata.role`) in auth middleware.
- Added startup env profile strictness (`APP_ENV`) and feature toggles (`FEATURE_*`) with fail-fast in demo/prod.
- Added RFC 9457 Problem Details responses for global/auth/validation error paths.
- Replaced static mobile settings device placeholders with live `/api/integrations/status` data.
- Added integration action metadata in `/api/integrations/status` and wired mobile Connect/Sync/Disconnect actions.
- Added signed/allowlisted OAuth `returnTo` handling for mobile/native callback targets.
- Restricted OAuth `returnTo` to allowlisted `http(s)` origins and hardened signed-state format.
- Added `/api/health/ingest` route for mobile HealthKit/Health Connect read-only ingestion payloads.
- Added DB-level idempotency keys (`external_id`) for `workouts` and `health_metrics` mobile ingest writes.
- Aligned mobile API default URL to `http://localhost:8787`.
- Normalized mobile injury severity mapping from DB scale `1-5` to body-map levels `20-100`.
- Added MCP endpoint and bridged all AI tools via shared tool factories.
- Standardized Azure instance-name resolution across AI clients.
- Added reusable agent error helpers for stream/chat routes.
- Centralized shared compute helpers in `@triathlon/core` (date/math/session-load).
- Added DB-backed queue and DB-backed rate-limiting helpers.
- Tightened CORS localhost allowlist.
- Added planned workout status migration and related RLS/index fixes.
- Removed stale mock-layer assumptions from web data hooks.
