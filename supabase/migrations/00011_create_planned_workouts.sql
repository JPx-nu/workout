-- ────────────────────────────────────────────────────────────────
-- Migration 00011: Create planned_workouts table
-- Separates planned/scheduled sessions from completed workouts.
-- When an athlete completes a planned workout, it links to the
-- existing workouts table via workout_id.
-- ────────────────────────────────────────────────────────────────

-- ── Table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planned_workouts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id         uuid NOT NULL REFERENCES public.clubs(id)    ON DELETE CASCADE,
  plan_id         uuid REFERENCES public.training_plans(id)    ON DELETE SET NULL,
  workout_id      uuid REFERENCES public.workouts(id)          ON DELETE SET NULL,

  -- Scheduling
  planned_date    date        NOT NULL,
  planned_time    time,

  -- Session definition
  activity_type   text NOT NULL CHECK (activity_type IN (
    'SWIM', 'BIKE', 'RUN', 'STRENGTH', 'YOGA', 'OTHER'
  )),
  title           text NOT NULL,
  description     text,
  duration_min    integer,
  distance_km     real,
  target_tss      real,
  target_rpe      smallint    CHECK (target_rpe BETWEEN 1 AND 10),
  intensity       text        CHECK (intensity IN (
    'RECOVERY', 'EASY', 'MODERATE', 'HARD', 'MAX'
  )),

  -- Structured session data (exercises for strength, intervals for cardio)
  session_data    jsonb       DEFAULT '{}',

  -- Status tracking
  status          text DEFAULT 'planned' CHECK (status IN (
    'planned', 'completed', 'skipped', 'modified', 'in_progress'
  )),

  -- Metadata
  sort_order      integer     DEFAULT 0,
  notes           text,
  coach_notes     text,
  source          text DEFAULT 'AI' CHECK (source IN ('AI', 'COACH', 'MANUAL')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_planned_workouts_athlete
  ON public.planned_workouts(athlete_id);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_date
  ON public.planned_workouts(planned_date);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_plan
  ON public.planned_workouts(plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_status
  ON public.planned_workouts(status);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_athlete_date
  ON public.planned_workouts(athlete_id, planned_date);

-- ── Auto-update updated_at trigger ────────────────────────────
CREATE OR REPLACE FUNCTION public.update_planned_workouts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_planned_workouts_updated_at
  BEFORE UPDATE ON public.planned_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planned_workouts_updated_at();

-- ── Add updated_at to training_plans ──────────────────────────
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.planned_workouts ENABLE ROW LEVEL SECURITY;

-- Athletes can read their own planned workouts
CREATE POLICY planned_workouts_select ON public.planned_workouts
  FOR SELECT USING (athlete_id = auth.uid());

-- Athletes can insert their own planned workouts
CREATE POLICY planned_workouts_insert ON public.planned_workouts
  FOR INSERT WITH CHECK (athlete_id = auth.uid());

-- Athletes can update their own planned workouts
CREATE POLICY planned_workouts_update ON public.planned_workouts
  FOR UPDATE USING (athlete_id = auth.uid());

-- Athletes can delete their own planned workouts
CREATE POLICY planned_workouts_delete ON public.planned_workouts
  FOR DELETE USING (athlete_id = auth.uid());

-- Service role can do everything (for API/AI tools)
CREATE POLICY planned_workouts_service ON public.planned_workouts
  FOR ALL USING (true) WITH CHECK (true);
