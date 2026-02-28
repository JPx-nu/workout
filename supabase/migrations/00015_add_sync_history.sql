-- ============================================================
-- Migration: Add sync_history table
-- Tracks every sync operation for debugging and visibility.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sync_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL,
    event_type text NOT NULL CHECK (
        event_type IN ('webhook', 'backfill', 'manual_sync')
    ),
    status text NOT NULL CHECK (
        status IN ('success', 'failed', 'skipped')
    ),
    workouts_added int DEFAULT 0,
    metrics_added int DEFAULT 0,
    error_message text,
    duration_ms int,
    created_at timestamptz DEFAULT now()
);
-- Index for athlete + time range queries (Settings page history)
CREATE INDEX IF NOT EXISTS idx_sync_history_athlete ON public.sync_history(athlete_id, created_at DESC);
-- Index for provider-level monitoring
CREATE INDEX IF NOT EXISTS idx_sync_history_provider ON public.sync_history(provider, status, created_at DESC);
-- RLS: users can only see their own sync history
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'sync_history'
        AND policyname = 'Users can view own sync history'
) THEN CREATE POLICY "Users can view own sync history" ON public.sync_history FOR
SELECT USING (athlete_id = auth.uid());
END IF;
END $$;
-- Service role needs full access (for webhook-queue inserts)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'sync_history'
        AND policyname = 'Service role full access'
) THEN CREATE POLICY "Service role full access" ON public.sync_history FOR ALL USING (true) WITH CHECK (true);
END IF;
END $$;