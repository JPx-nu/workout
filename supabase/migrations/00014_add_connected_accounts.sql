-- ============================================================
-- Migration: Add connected_accounts table
-- Stores OAuth tokens for external fitness platform connections.
-- ============================================================
-- Connected external accounts (Strava, Garmin, Polar, Wahoo, Suunto)
CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    athlete_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (
        provider IN (
            'STRAVA',
            'GARMIN',
            'POLAR',
            'WAHOO',
            'SUUNTO'
        )
    ),
    access_token text NOT NULL,
    refresh_token text,
    token_expires timestamptz,
    provider_uid text,
    scopes text [],
    last_sync_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(athlete_id, provider)
);
-- Indexes for webhook lookups (provider + provider_uid) and user queries
CREATE INDEX IF NOT EXISTS idx_connected_accounts_athlete ON public.connected_accounts(athlete_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_provider_uid ON public.connected_accounts(provider, provider_uid);
-- Extend workouts source constraint to include new providers
-- Note: This is idempotent — safe to run multiple times
DO $$ BEGIN -- Drop existing constraint if it exists
IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'workouts_source_check'
        AND table_name = 'workouts'
) THEN
ALTER TABLE public.workouts DROP CONSTRAINT workouts_source_check;
END IF;
-- Add updated constraint with all provider sources
ALTER TABLE public.workouts
ADD CONSTRAINT workouts_source_check CHECK (
        source IN (
            'GARMIN',
            'POLAR',
            'WAHOO',
            'FORM',
            'MANUAL',
            'HEALTHKIT',
            'HEALTH_CONNECT',
            'STRAVA',
            'SUUNTO'
        )
    );
END $$;
-- RLS: users can only see/manage their own connected accounts
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN -- Select policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'connected_accounts'
        AND policyname = 'Users can view own accounts'
) THEN CREATE POLICY "Users can view own accounts" ON public.connected_accounts FOR
SELECT USING (athlete_id = auth.uid());
END IF;
-- All operations policy
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'connected_accounts'
        AND policyname = 'Users can manage own accounts'
) THEN CREATE POLICY "Users can manage own accounts" ON public.connected_accounts FOR ALL USING (athlete_id = auth.uid());
END IF;
END $$;