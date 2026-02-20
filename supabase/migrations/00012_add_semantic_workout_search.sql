-- ============================================================
-- Migration: Add Semantic Workout Search
-- Adds vector embeddings to workouts for natural language search
-- ============================================================

-- 1. Add embedding column to workouts
ALTER TABLE public.workouts ADD COLUMN IF NOT EXISTS embedding vector(2000);

-- 2. Create HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_workouts_embedding 
  ON public.workouts 
  USING hnsw (embedding vector_cosine_ops);

-- 3. Create match function
CREATE OR REPLACE FUNCTION public.match_workouts(
    p_athlete_id uuid,
    query_embedding vector(2000),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    activity_type text,
    started_at timestamptz,
    distance_m real,
    duration_s integer,
    notes text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.activity_type,
        w.started_at,
        w.distance_m,
        w.duration_s,
        w.notes,
        1 - (w.embedding <=> query_embedding) AS similarity
    FROM public.workouts w
    WHERE w.athlete_id = p_athlete_id
      AND w.embedding IS NOT NULL
      AND 1 - (w.embedding <=> query_embedding) > match_threshold
    ORDER BY w.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
