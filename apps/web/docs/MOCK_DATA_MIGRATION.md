# Mock Data Migration Guide

All mock data lives in `apps/web/src/lib/mock/` and is consumed via hooks in `apps/web/src/hooks/`.
Every mock item is tagged with `@mock` comments for easy search (`grep -r "@mock"`).

---

## Architecture

```
lib/mock/             ← Data layer (replace file-by-file)
├── index.ts          ← Barrel export
├── profile.ts        ← User profile
├── workouts.ts       ← Workout history + weekly stats
├── training.ts       ← Training plan + events
├── coach.ts          ← AI conversation + prompts
└── health.ts         ← Fatigue, daily logs, health snapshot

hooks/                ← Service layer (swap internals)
├── use-profile.ts    ← useProfile()
├── use-workouts.ts   ← useWorkouts()
├── use-training.ts   ← useTraining()
├── use-coach.ts      ← useCoach()
└── use-health.ts     ← useHealth()
```

## How to Replace a Mock with Real Data

Each hook documents the exact Supabase query needed. Example from `use-workouts.ts`:

```ts
// @mock — swap this block
const allWorkouts = mockWorkouts;

// @real Will use:
//   const { data } = await supabase
//     .from('workouts')
//     .select('*')
//     .eq('athlete_id', userId)
//     .order('started_at', { ascending: false })
```

### Step-by-step process:

1. Open the hook file (e.g., `hooks/use-workouts.ts`)
2. Find the `// @mock — swap this block` comment
3. Replace the mock data import with a Supabase query
4. Keep the return signature identical — **no page changes needed**
5. Delete the corresponding mock file(s) from `lib/mock/` once all usages are removed
6. Remove the export from `lib/mock/index.ts`

---

## Migration Checklist

| Domain | Hook | Mock File | Supabase Table(s) | Status |
|--------|------|-----------|-------------------|--------|
| Profile | `useProfile` | `mock/profile.ts` | `auth.users` + `profiles` + `clubs` | 🟡 Mock |
| Workouts | `useWorkouts` | `mock/workouts.ts` | `workouts` | 🟡 Mock |
| Training | `useTraining` | `mock/training.ts` | `training_plans` + `events` | 🟡 Mock |
| AI Coach | `useCoach` | `mock/coach.ts` | `conversations` + `messages` + API | 🟡 Mock |
| Health | `useHealth` | `mock/health.ts` | `health_metrics` + `daily_logs` + `injuries` | 🟡 Mock |

Update status to 🟢 Real when migration is complete.

---

## Finding All Mock References

```bash
# Find all @mock tags
grep -rn "@mock" apps/web/src/

# Find all mock imports
grep -rn "from '@/lib/mock" apps/web/src/

# Find all hook usages
grep -rn "useProfile\|useWorkouts\|useTraining\|useCoach\|useHealth" apps/web/src/
```

## Type Alignment

Mock types in `lib/mock/` mirror the Supabase schema:
- `Workout.durationSec` → `workouts.duration_sec`
- `Workout.distanceM` → `workouts.distance_m`
- `Workout.avgHr` → `workouts.avg_hr`

The hooks handle any `snake_case → camelCase` mapping needed.
