# Data Layer Migration Status

> **Last Updated:** 2026-03-03

This document replaces the old mock migration checklist.

## Current state

The previous `src/lib/mock/*` layer has been removed. Web hooks now use:

- Supabase directly for profile/workout/training/health data
- API routes for AI chat streaming and planned workout mutations

## Hook status

| Hook | Source | Status |
|---|---|---|
| `useProfile` | Supabase (`profiles`, `clubs`) | Real |
| `useWorkouts` | Supabase (`workouts`) | Real |
| `useTraining` | Supabase (`training_plans`, `events`) | Real |
| `useHealth` | Supabase (`daily_logs`, `injuries`) | Real |
| `useCoach` | API `/api/ai/stream` + Supabase `messages`/storage | Real |
| `usePlannedWorkouts` | API `/api/planned-workouts` | Real |

## Remaining work (not mock-related)

- Expand typed API client usage (`@triathlon/api-client`) if shared consumers are desired.
- Increase automated integration tests around auth + API chat flows.
