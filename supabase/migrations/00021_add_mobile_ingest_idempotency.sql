-- ============================================================
-- Migration: Add explicit idempotency keys for mobile health ingest
-- ============================================================

ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS external_id text;

ALTER TABLE public.health_metrics
ADD COLUMN IF NOT EXISTS external_id text;

-- Enforce idempotency for provider-originated records.
-- Partial unique index allows legacy rows with null/empty external_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_athlete_source_external_id_unique
  ON public.workouts (athlete_id, source, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_metrics_athlete_source_external_id_unique
  ON public.health_metrics (athlete_id, source, external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE INDEX IF NOT EXISTS idx_workouts_external_id
  ON public.workouts (external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';

CREATE INDEX IF NOT EXISTS idx_health_metrics_external_id
  ON public.health_metrics (external_id)
  WHERE external_id IS NOT NULL AND btrim(external_id) <> '';
