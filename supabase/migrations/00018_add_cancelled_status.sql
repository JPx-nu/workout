-- ============================================================
-- Migration: Add 'cancelled' to planned_workouts status CHECK
--
-- The TypeScript schema (PlannedWorkoutStatus) already includes
-- 'cancelled' but the DB constraint was missing it.
-- ============================================================

ALTER TABLE public.planned_workouts
  DROP CONSTRAINT IF EXISTS planned_workouts_status_check;

ALTER TABLE public.planned_workouts
  ADD CONSTRAINT planned_workouts_status_check
  CHECK (status IN ('planned', 'completed', 'skipped', 'modified', 'in_progress', 'cancelled'));
