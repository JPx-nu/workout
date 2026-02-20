-- ============================================================
-- Migration: Add Athlete Memories
-- Stores long-term preferences, goals, and constraints
-- ============================================================

CREATE TABLE IF NOT EXISTS public.athlete_memories (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('preference', 'goal', 'constraint', 'pattern', 'medical_note', 'other')),
    content text NOT NULL,
    embedding vector(2000),
    importance integer DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Index for semantic search over memories
CREATE INDEX IF NOT EXISTS idx_athlete_memories_embedding 
  ON public.athlete_memories 
  USING hnsw (embedding vector_cosine_ops);

-- RLS
ALTER TABLE public.athlete_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view their own memories"
    ON public.athlete_memories FOR SELECT
    USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can insert their own memories"
    ON public.athlete_memories FOR INSERT
    WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Athletes can update their own memories"
    ON public.athlete_memories FOR UPDATE
    USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can delete their own memories"
    ON public.athlete_memories FOR DELETE
    USING (auth.uid() = athlete_id);

-- Match function
CREATE OR REPLACE FUNCTION public.match_memories(
    p_athlete_id uuid,
    query_embedding vector(2000),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    category text,
    content text,
    importance integer,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.category,
        m.content,
        m.importance,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM public.athlete_memories m
    WHERE m.athlete_id = p_athlete_id
      AND m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> query_embedding) > match_threshold
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
