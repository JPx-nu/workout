# Web v1 Feature Matrix

Last Updated: 2026-03-11

| Area | Status | Notes |
|---|---|---|
| Landing page | Shipped | `/workout/` markets the current athlete-first web scope |
| Auth and sessions | Shipped | Supabase auth with web login and guarded dashboard routes |
| Onboarding flow | Shipped | Completion now falls back to direct profile persistence if API transport fails |
| Dashboard views | Shipped | Triathlon and strength default views backed by live profile state |
| Workout history | Shipped | Reads from live workouts data |
| Training calendar | Shipped | Uses planned-workout API routes and supported status updates |
| AI Coach streaming chat | Shipped | Uses `/api/ai/stream`, conversation history, and image attachments |
| AI Coach onboarding prompt | Beta-hardening | Optional coach step; onboarding completion no longer depends on coach success |
| 2D body map | Shipped | Backed by `daily_logs` and `injuries` |
| 3D body map | Roadmap / Experimental | Sample-data preview only, not part of supported web-v1 surface |
| Settings profile edit | Shipped | Display name and timezone |
| Dashboard default view setting | Shipped | Triathlon and strength |
| Onboarding redo | Shipped | Available from settings |
| Sign out | Shipped | Web sign-out form action |
| Theme toggle | Shipped | Dashboard shell supports dark/light theme switching |
| PWA manifest / install prompt | Shipped | Serwist manifest and install prompt are wired for supported browsers |
| Integrations status | Shipped | Uses live `/api/integrations/status` contract |
| Strava connect/sync/disconnect | Shipped | Available via settings control plane |
| Polar connect/sync/disconnect | Shipped | Available via settings control plane |
| Wahoo connect/sync/disconnect | Shipped | Available via settings control plane |
| Garmin connect | Roadmap | Pending provider approval; returns problem response |
| Garmin sync | Roadmap | Pending provider approval; returns problem response |
| HealthKit / Health Connect in web UI | Out of scope | API ingest exists for mobile but not surfaced in web product |
| Team gamification / relays | Roadmap | Not part of athlete cockpit acceptance |
| Notifications settings | Out of scope | Not persisted or exposed in supported settings UI |
| Export data | Out of scope | No end-to-end supported implementation |
| Delete account | Out of scope | No end-to-end supported implementation |
