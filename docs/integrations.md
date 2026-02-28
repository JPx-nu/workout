# Fitness Platform Integration Library

> **Version:** 1.0.0 · **Last Updated:** 2026-02-27
> **Domain:** `jpx.nu` · **API:** `jpx-workout-api.azurewebsites.net`

---

## Overview

Provider-agnostic integration library for syncing workout and health data from external fitness platforms. Built for reusability — adding a new provider takes ~2 hours.

### Supported Platforms

| Platform | OAuth | Webhooks | Workouts | Health Data | Status |
|---|---|---|---|---|---|
| **Strava** | OAuth2 | ✅ | ✅ Swim/Bike/Run + 10 types | — | ✅ Ready |
| **Garmin** | OAuth 1.0a | ✅ | ✅ | HRV, Sleep, HR, Steps | ⏳ Needs API approval |
| **Polar** | OAuth2 | ✅ | ✅ | Sleep (Nightly Recharge) | ✅ Ready |
| **Wahoo** | OAuth2 | ✅ | ✅ + Power data | — | ✅ Ready |

---

## Architecture

```
services/integrations/
├── types.ts            ← IntegrationProvider interface + normalized types
├── registry.ts         ← Provider map (getProvider, getAllProviders)
├── oauth.ts            ← Generic OAuth flow (connect → exchange → backfill)
├── oauth-state.ts      ← HMAC-SHA256 signed state (CSRF protection)
├── crypto.ts           ← AES-256-GCM token encryption at rest
├── normalizer.ts       ← Dedup pipeline + daily_log auto-fill
├── token-manager.ts    ← Auto-refresh (5-min buffer) + decrypt-on-read
├── webhook-queue.ts    ← Async job queue with retry (3 attempts)
├── http.ts             ← fetchWithRetry (exponential backoff + jitter)
├── errors.ts           ← Typed error hierarchy
├── index.ts            ← Barrel export
└── providers/
    ├── strava.ts       ← Strava API v3
    ├── garmin.ts       ← Garmin Health API (stub)
    ├── polar.ts        ← Polar AccessLink API
    └── wahoo.ts        ← Wahoo Cloud API
```

### Data Pipeline

```mermaid
graph LR
    A[Webhook / Manual Sync] --> B[Verify Signature]
    B --> C[Enqueue Job]
    C --> D[Refresh Token]
    D --> E[Fetch Activity]
    E --> F[Normalize]
    F --> G[Dedup Check]
    G --> H[Insert Workout]
    H --> I[Auto-fill DailyLog]
    I --> J[Log to sync_history]
```

---

## Security

| Feature | Implementation |
|---|---|
| **CSRF Protection** | OAuth `state` = HMAC-SHA256(athleteId + timestamp), 10-min expiry |
| **Token Encryption** | AES-256-GCM, 12-byte IV, 16-byte auth tag, stored as base64 |
| **Webhook Verification** | Provider-specific signature check before processing |
| **Token Refresh** | Auto-refresh 5 min before expiry, re-encrypted on save |
| **RLS** | `connected_accounts` + `sync_history` scoped to `auth.uid()` |

### Environment Variables

```env
# Required for Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_VERIFY_TOKEN=jpx-triathlon-strava

# Token encryption (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
INTEGRATION_ENCRYPTION_KEY=64_char_hex_string

# API base URL (used for OAuth callback URLs)
API_URL=https://jpx.nu
```

---

## API Endpoints

### OAuth (JWT-protected, under `/api/integrations/`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/:provider/connect` | Redirect to provider OAuth page |
| `GET` | `/:provider/callback` | OAuth callback (exchanges code, backfills 30 days) |
| `POST` | `/:provider/disconnect` | Revoke access + delete tokens |
| `POST` | `/:provider/sync` | Manual sync, last 7 days (5-min cooldown) |
| `GET` | `/status` | All providers + connection status |
| `GET` | `/sync-history?limit=20&provider=STRAVA` | Recent sync operations |

### Webhooks (public, under `/webhooks/`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/strava` | Activity create events |
| `GET` | `/strava` | Subscription validation (hub.challenge) |
| `POST` | `/garmin` | Activity + health events |
| `POST` | `/polar` | Exercise events |
| `POST` | `/wahoo` | Workout summary events |

---

## Database

### `connected_accounts` (Migration 00014)

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `athlete_id` | uuid FK | References `profiles.id` |
| `provider` | text | STRAVA, GARMIN, POLAR, WAHOO, SUUNTO |
| `access_token` | text | AES-256-GCM encrypted |
| `refresh_token` | text | AES-256-GCM encrypted |
| `token_expires` | timestamptz | Expiry timestamp |
| `provider_uid` | text | User ID on provider platform |
| `scopes` | text[] | Granted OAuth scopes |
| `last_sync_at` | timestamptz | Last successful sync |

### `sync_history` (Migration 00015)

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `athlete_id` | uuid FK | References `profiles.id` |
| `provider` | text | Provider name |
| `event_type` | text | webhook, backfill, manual_sync |
| `status` | text | success, failed, skipped |
| `workouts_added` | int | Count of new workouts |
| `metrics_added` | int | Count of new metrics |
| `error_message` | text | Error details (if failed) |
| `duration_ms` | int | Processing time |

---

## Adding a New Provider

### Step 1: Implement `IntegrationProvider`

Create `providers/coros.ts`:

```typescript
import type { IntegrationProvider, OAuthConfig, ... } from "../types.js";

export class CorosProvider implements IntegrationProvider {
  readonly name = "COROS" as const;
  readonly oauthConfig: OAuthConfig = { ... };

  buildAuthUrl(state: string): string { ... }
  async exchangeCode(code: string): Promise<OAuthTokens> { ... }
  async refreshToken(refreshToken: string): Promise<OAuthTokens> { ... }
  async revokeAccess(accessToken: string): Promise<void> { ... }
  verifyWebhook(headers, body): boolean { ... }
  extractOwnerIdFromWebhook(event): string { ... }
  extractActivityIdFromWebhook(event): string { ... }
  async fetchActivity(accessToken, id): Promise<NormalizedWorkout> { ... }
  async fetchActivities(accessToken, since): Promise<NormalizedWorkout[]> { ... }
  mapActivityType(type: string): ActivityType { ... }
}
```

### Step 2: Register

In `registry.ts`:

```typescript
import { CorosProvider } from "./providers/coros.js";
// Add to the Map:
["COROS", new CorosProvider()],
```

### Step 3: Create Routes

Copy any existing route file (e.g., `strava.ts`) and change the provider name.

### Step 4: Update Infrastructure

- Add webhook route in `webhooks/index.ts`
- Add provider to `connected_accounts` CHECK constraint
- Add env vars to `config/integrations.ts`
- Add to `workouts.source` CHECK constraint

**Estimated time: ~2 hours per provider.**

---

## Strava Setup Guide (jpx.nu)

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create application:
   - **Name:** JPX Workout
   - **Category:** Data Importer
   - **Website:** `https://jpx.nu`
   - **Callback Domain:** `jpx.nu`
3. Copy **Client ID** and **Client Secret**
4. Set Azure env vars:

   ```
   STRAVA_CLIENT_ID=<from Strava>
   STRAVA_CLIENT_SECRET=<from Strava>
   STRAVA_VERIFY_TOKEN=jpx-triathlon-strava
   API_URL=https://jpx.nu
   ```

5. Register webhook subscription:

   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -d client_id=YOUR_ID \
     -d client_secret=YOUR_SECRET \
     -d callback_url=https://jpx.nu/webhooks/strava \
     -d verify_token=jpx-triathlon-strava
   ```

---

## Best Practices & Future Expansion

> **Continuously evaluate** emerging fitness APIs and aggregators for expanding platform coverage with minimal effort.

### Candidate Platforms

- **Coros** — Growing triathlon community, REST API available
- **Whoop** — Recovery/strain data, HRV-focused
- **Oura** — Sleep + readiness rings, strong health data
- **FORM** — Swim goggles with in-water metrics
- **Suunto** — Already in our type system, REST API available

### Aggregator Option

- **Terra API** — Single integration for 20+ providers (Garmin, Whoop, Oura, etc.)
  - Pro: one integration = many providers
  - Con: per-user pricing, data latency
- **ROOK** — Similar aggregator, newer entrant
