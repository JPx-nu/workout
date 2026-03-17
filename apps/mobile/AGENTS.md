# AGENTS.md

Guidance for `apps/mobile`.

## Start Here

- Read `apps/mobile/README.md`.
- Read `docs/integrations.md` when touching OAuth return flows or provider status/actions.
- Check the root `AGENTS.md` and `docs/technical-reference.md` for shipped-scope boundaries.

## Local Rules

- This is a Flutter app outside pnpm/Turbo. Do not assume Node workspace scripts apply here.
- Runtime configuration comes from compile-time `--dart-define` values. `API_URL` defaults to `http://localhost:8787` when omitted.
- `APP_LINK_URL` must remain an allowlisted absolute `http(s)` URL because API OAuth `returnTo` rejects custom schemes today.
- Settings integration UI should stay wired to the live `/api/integrations/status` contract and provider action endpoints. Do not replace it with local provider lists or fake status data.
- Notification toggles, appearance, and biometric lock rows are currently UI scaffolds only. Do not document them as persisted functionality unless that code is added.
- The mobile health ingest route exists, but native HealthKit / Health Connect permission UX is not shipped yet.

## Docs to Update When Behavior Changes

- `apps/mobile/README.md`
- `docs/technical-reference.md`
- `docs/integrations.md` when OAuth or provider behavior changes

## Validation

- Always finish with root `pnpm lint` and `pnpm type-check`; the repo pre-commit hook still runs those commands for mobile-only changes.
- Run the smallest meaningful Flutter validation available locally, typically `flutter analyze` and any targeted tests
