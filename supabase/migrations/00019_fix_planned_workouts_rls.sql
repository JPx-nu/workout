-- ============================================================
-- Migration: Fix planned_workouts RLS for coach access
--
-- The existing SELECT policy only checks athlete_id, which means
-- coaches cannot see their athletes' planned workouts.
-- Replace with club-aware policy matching the pattern from 00005.
-- ============================================================

-- Drop the athlete-only SELECT policy
DROP POLICY IF EXISTS planned_workouts_select ON public.planned_workouts;

-- Athletes can view their own planned workouts,
-- coaches/admins/owners can view any planned workout in their club
CREATE POLICY planned_workouts_select ON public.planned_workouts
  FOR SELECT USING (
    athlete_id = auth.uid()
    OR club_id IN (
      SELECT p.club_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('coach', 'admin', 'owner')
    )
  );
