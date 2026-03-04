# External Beta Plan (Steps 1-3)

Last updated: 2026-03-03
Owner: Platform + Mobile
Status: Proposed

---

## Scope

This plan expands the first three beta preparation steps:

1. API hardening baseline
2. Mobile integration control plane
3. HealthKit + Health Connect read-only ingestion MVP

The plan is aligned to current repository behavior (Hono API + Flutter mobile + Supabase).

---

## Current-State Anchors (Repo)

- API startup env validation now uses `APP_ENV` + `FEATURE_*` gating (fails hard in `demo/prod` for required feature keys; warns in `local`).
- Integrations status route exists at `GET /api/integrations/status`.
- Webhook queue + async processing already exists.
- Mobile settings now renders live integration status from the API.

Inference: these foundations reduce implementation risk for steps 1-3 and allow us to focus on hardening + productization rather than greenfield buildout.

---

## Step 1: API Hardening Baseline

### Objectives

- Eliminate configuration ambiguity across local/demo/prod.
- Standardize error responses for clients and observability.
- Close webhook/OAuth hardening gaps before external traffic.

### Workstreams

#### 1.1 Environment policy matrix and fail-fast behavior

- Define an explicit environment matrix (`local`, `demo`, `prod`) with key classes:
  - `required_always`
  - `required_if_feature_enabled`
  - `optional`
- Add a single source of truth for feature toggles:
  - `FEATURE_AI_ENABLED`
  - `FEATURE_INTEGRATIONS_ENABLED`
  - `FEATURE_MCP_ENABLED`
- Enforce:
  - `prod` and `demo`: fail startup if any required feature key is missing.
  - `local`: warn for feature keys; fail only core runtime keys.
- Add URL and scheme validation:
  - Parse `API_URL`, `WEB_URL` with URL constructor.
  - Require `https` in `prod` for externally reachable URLs.

Deliverables:

- `startup-env` validator with profile-aware rules.
- `docs/technical-reference.md` env matrix section.

Acceptance:

- Boot fails deterministically for invalid `prod/demo` config.
- CI covers key-matrix checks.

#### 1.2 API error taxonomy (RFC 9457)

- Standardize all non-2xx responses to `application/problem+json`.
- Use fields: `type`, `title`, `status`, `detail`, `instance`.
- Add extension members:
  - `code` (stable machine error code)
  - `requestId` (trace correlation)
  - `hint` (safe remediation text)
- Define a stable code catalog for auth/integration/sync errors.
- Ensure handlers do not leak internals in production.

Deliverables:

- Shared problem-details response helper + middleware adapter.
- Error code registry doc (`docs/api-errors.md`).

Acceptance:

- Contract tests validate response shape for critical endpoints.
- Logs/metrics retain full diagnostics while API response remains safe.

#### 1.3 Webhook/OAuth parity hardening

- Confirm each provider route has:
  - Verification gate before processing.
  - Fast ACK path + async queue processing.
  - Replay guard (dedupe by provider delivery identifier when available).
  - Retry-safe idempotency for downstream inserts.
- Explicitly mark Garmin as partial in API response metadata (until fully implemented).
- Add provider-level health checks and dashboard counters:
  - verification failures
  - queue latency
  - dead-letter count

Deliverables:

- Provider parity checklist in `docs/integrations.md`.
- Alert thresholds for queue lag + signature failures.

Acceptance:

- Negative tests (bad signature, replay payload, malformed event) pass.
- No duplicate writes under repeated delivery simulation.

### Risks and Mitigation

- Risk: strict env gating blocks demos unexpectedly.
  - Mitigation: dry-run mode in CI + preflight script before deploy.
- Risk: provider docs differ on retry semantics.
  - Mitigation: per-provider adapter tests + explicit fallback behavior.

---

## Step 2: Mobile Integration Control Plane

### Objectives

- Give users full connection lifecycle control (connect/disconnect/sync-now).
- Make integration state understandable and actionable.
- Keep OAuth and callback handling native-safe.

### Workstreams

#### 2.1 State model + UX contract

- Standardize per-provider UI states:
  - `not_connected`
  - `connecting`
  - `connected_fresh`
  - `connected_stale`
  - `sync_in_progress`
  - `error_action_required`
- Define stale thresholds:
  - `fresh`: sync < 6h
  - `stale`: 6h-24h
  - `critical`: >24h

Inference: these thresholds are product defaults and should be tuned after beta telemetry.

Deliverables:

- Shared integration state mapper in mobile settings feature.
- User-facing remediation copy for each error state.

Acceptance:

- Every backend status state maps to one deterministic UI state.
- No ambiguous status text in settings.

#### 2.2 OAuth connect flow (mobile-safe)

- Use external user-agent/system browser flow only.
- Enforce Authorization Code + PKCE.
- Implement secure callback handling:
  - universal link/app link callback
  - one-time `state` validation
  - anti-replay checks
- Avoid embedded webviews for auth.

Deliverables:

- Connect launcher + callback handler per platform.
- OAuth error recovery screens (cancel, denied, timeout, bad state).

Acceptance:

- Connect succeeds end-to-end on iOS + Android.
- Malicious/corrupted callback state is rejected.

#### 2.3 Integration actions + telemetry

- Add per-provider actions:
  - `Connect`
  - `Disconnect`
  - `Sync now`
- Add minimal event telemetry:
  - connect_started/succeeded/failed
  - sync_triggered/succeeded/failed
  - stale_state_entered/resolved

Deliverables:

- Mobile API calls for connect/disconnect/sync.
- Event taxonomy doc for analytics and support.

Acceptance:

- Manual sync is rate-limited gracefully with user feedback.
- Support can trace a user’s integration journey from logs.

### Risks and Mitigation

- Risk: OAuth callback reliability differs by OEM/browser.
  - Mitigation: test matrix across at least 3 Android OEMs + iOS versions.
- Risk: users interpret stale data as broken integrations.
  - Mitigation: explicit stale indicators + remediation CTA in UI.

---

## Step 3: HealthKit + Health Connect Read-Only Ingestion MVP

### Objectives

- Ingest core health metrics safely and consistently.
- Keep sync incremental, restart-safe, and privacy-minimal.
- Feed existing tables without schema churn where possible.

### MVP Data Scope

- Workouts
- Sleep duration
- Resting heart rate
- HRV

### Workstreams

#### 3.1 Consent + permission architecture

- iOS:
  - Enable HealthKit capability.
  - Set required privacy usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` if needed).
  - Request per-type permissions only when needed.
- Android:
  - Declare required Health Connect permissions in manifest and Play Console.
  - Request runtime permissions on demand.
  - Request history/background permissions only if truly required.

Deliverables:

- Unified permission screen model with platform-specific mapping.
- Permission audit checklist in docs.

Acceptance:

- No data read is attempted without explicit grant.
- Denied permissions degrade gracefully (no crash/no silent failure).

#### 3.2 Incremental sync design

- iOS ingestion strategy:
  - Snapshot reads for initial backfill.
  - Long-running query model using observer/anchored patterns where appropriate.
  - Persist anchors/checkpoints locally for incremental continuation.
- Android ingestion strategy:
  - Use `getChangesToken` and `getChanges` for differential sync.
  - Keep separate change tokens per independently consumed data type.
  - Handle token expiry with deterministic re-sync strategy.
- Resume semantics:
  - Save sync cursor and last successful sync timestamp.
  - Continue from cursor after app restart.

Deliverables:

- Sync cursor schema (local) + recovery rules.
- Platform sync engine interfaces with shared normalization pipeline.

Acceptance:

- Duplicate ingestion rate < 0.5% in replay tests.
- Resume-after-crash recovers without full reset in normal conditions.

#### 3.3 Normalization + write path

- Map platform records to canonical fields for:
  - `workouts`
  - `daily_logs`
  - `health_metrics`
- Add provenance metadata:
  - source platform (`HEALTHKIT`, `HEALTH_CONNECT`)
  - original source app/device when available
- Enforce idempotent upsert keys to prevent duplicates.

Deliverables:

- Mapping spec doc + test vectors per record type.
- Ingestion writer with dedupe logic.

Acceptance:

- Identical source records do not create duplicate rows.
- Unit conversions are deterministic and tested.

#### 3.4 Background behavior and reliability

- Android:
  - Use WorkManager for periodic/background reads (permission-gated).
- iOS:
  - Use HealthKit background delivery entitlement where required for observer updates.
- Add retry/backoff and bounded queueing for transient failures.

Deliverables:

- Background sync scheduling policy doc.
- Failure/timeout retry policy with caps.

Acceptance:

- Sync survives temporary offline periods and resumes automatically.
- Background sync respects platform limits and user permissions.

### Risks and Mitigation

- Risk: platform constraints cause inconsistent background delivery.
  - Mitigation: foreground sync on app resume as canonical fallback.
- Risk: historical data permission gaps create “partial” history.
  - Mitigation: clearly label history horizon and prompt optional extended permissions.

---

## Cross-Cutting: Context7 MCP Enrichment Lane

Goal: ensure implementation decisions reference current library docs, not stale model memory.

### Tasks

- Configure Context7 as remote MCP server in dev clients.
- Add team rule:
  - always use Context7 for external library/API usage questions.
- Add PR checklist item:
  - external API/library changes must include doc source links (Context7-resolved when possible).
- Add quick connectivity and version checks:
  - MCP server ping
  - package/server version freshness

### Suggested configs

- Remote MCP endpoint: `https://mcp.context7.com/mcp`
- Claude Code local example:
  - `claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp --api-key YOUR_API_KEY`
- Claude Code remote example:
  - `claude mcp add --scope user --header "CONTEXT7_API_KEY: YOUR_API_KEY" --transport http context7 https://mcp.context7.com/mcp`

---

## Milestones (Suggested)

- Week 1 (2026-03-04 to 2026-03-10): Step 1 complete.
- Week 2 (2026-03-11 to 2026-03-17): Step 2 complete.
- Week 3-4 (2026-03-18 to 2026-03-31): Step 3 MVP complete and stabilized.

Go/No-Go gate before external beta:

- Step 1-3 acceptance criteria all pass.
- No open P0 issues on auth, webhook verification, or health data correctness.

---

## Source Notes (Best-Practice Inputs)

- [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [RFC 8252: OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252)
- [RFC 9700: OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700)
- [The Twelve-Factor App: Config](https://12factor.net/config)
- [Strava Webhooks](https://developers.strava.com/docs/webhooks/)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [GitHub Webhook Best Practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- Apple HealthKit:
  - [Authorizing Access to Health Data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
  - [Reading Data from HealthKit](https://developer.apple.com/documentation/healthkit/reading-data-from-healthkit)
  - [HealthKit Background Delivery Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
  - [`NSHealthShareUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nshealthshareusagedescription)
- Android Health Connect:
  - [Get Started](https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started)
  - [Read Data](https://developer.android.com/health-and-fitness/guides/health-connect/develop/read-data)
  - [Sync Data](https://developer.android.com/health-and-fitness/guides/health-connect/develop/sync-data)
  - [Display Data Attribution](https://developer.android.com/health-and-fitness/guides/health-connect/develop/display-data-attribution)
- Context7 MCP:
  - [Context7 Docs: Claude Code Integration](https://context7.com/docs/integrations/claude-code)
  - [Context7 GitHub](https://github.com/upstash/context7)
