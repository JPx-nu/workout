# Mobile App (`apps/mobile`)

Flutter client for triathlon + strength workflows.

## Stack

- Flutter (Dart SDK `^3.11.0`)
- Riverpod 3
- GoRouter
- Supabase Flutter
- Dio
- Local auth + secure storage

## Run locally

```bash
cd apps/mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-publishable-key \
  --dart-define=API_URL=http://localhost:8787 \
  --dart-define=APP_LINK_URL=https://jpx.nu/workout/settings
```

## Current app structure

- Auth: login + auth provider/repository
- Dashboard shell with tab navigation
- Workouts
- Training
- Coach
- Body map
- Settings

## Notes

- This app is separate from pnpm/Turbo workflows.
- Supabase is initialized in `lib/main.dart` via compile-time `--dart-define` values.
- `API_URL` defaults to `http://localhost:8787` if omitted.
- `APP_LINK_URL` defines the OAuth return target used by mobile integration connect flows and must be an allowlisted `http(s)` URL.
- Settings "Connected Devices" reads live data from `GET /api/integrations/status`.
- Settings integration tiles now support Connect/Sync/Disconnect action sheet per provider.
