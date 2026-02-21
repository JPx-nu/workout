-- ==============================================================================
-- Migration: Add AS RESTRICTIVE policies to prevent OAuth clients from accessing
-- highly sensitive health/telemetry data directly.
-- ==============================================================================

-- Health Metrics (highly sensitive raw biometric data)
CREATE POLICY "Block OAuth clients from health_metrics"
  ON public.health_metrics
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

-- Daily Logs (recovery, sleep, hrv summaries)
CREATE POLICY "Block OAuth clients from daily_logs"
  ON public.daily_logs
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

-- Workouts (GPS, high-frequency HR telemetry)
CREATE POLICY "Block OAuth clients from workouts"
  ON public.workouts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

-- Injuries (medical/health data)
CREATE POLICY "Block OAuth clients from injuries"
  ON public.injuries
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

-- Planned Workouts (could contain coach notes or health info)
CREATE POLICY "Block OAuth clients from planned_workouts"
  ON public.planned_workouts
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);

-- Athlete Memories (could contain medical notes or goals)
CREATE POLICY "Block OAuth clients from athlete_memories"
  ON public.athlete_memories
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'client_id') IS NULL);
