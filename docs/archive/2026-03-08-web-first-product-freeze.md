# Web-First Product Freeze Archive

Date: 2026-03-08

## Decision

The product is freezing around a web-first athlete cockpit before committing to the proper native app contract.

This archive replaces the earlier Android-first beta sequencing as the primary product-shaping document.

## Why

- The current web app already contains the core athlete journey.
- Several mobile-facing decisions are still unstable: callback policy, provider scope, package naming, and health-ingest rollout.
- Shipping a native shell before the product contract is truthful would lock in the wrong UX and API expectations.

## Accepted Scope

Web v1 is:
- auth, session handling, and onboarding
- dashboard with triathlon and strength views
- workouts history
- training calendar and planned-workout state changes already supported by API
- AI Coach with streaming chat, history, and image attachments
- 2D body map backed by real health and injury data
- settings for profile, dashboard view, onboarding redo, sign-out, and live integrations state/actions

Web v1 is not:
- team gamification or relay UX
- Garmin availability for end users
- HealthKit or Health Connect surfaced in web UI
- 3D body map as a supported feature
- export/delete-account UI
- notification settings UI

## Implementation Notes Captured

- Landing copy, metadata, and manifest should describe the athlete cockpit, not roadmap features.
- Settings must read from the same integrations control plane used by mobile.
- Garmin remains visible only as roadmap or pending approval.
- Onboarding completion must not trap the user if the coach/API transport fails.
- `NEXT_PUBLIC_API_URL` is now treated as deployment-critical because coach, onboarding, planned workouts, and integrations depend on it.

## Native App Implication

Do not freeze the native contract until the web-v1 contract is stable for:
- supported providers
- callback URL rules
- health-ingest rollout
- feature messaging

The proper app should be built around the frozen web product, not around roadmap copy.
