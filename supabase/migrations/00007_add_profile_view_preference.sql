-- ============================================================
-- Migration: Add default_view preference to profiles
-- ============================================================

ALTER TABLE public.profiles
ADD COLUMN default_view text NOT NULL DEFAULT 'triathlon'
CHECK (default_view IN ('triathlon', 'strength'));

-- Comment on column
COMMENT ON COLUMN public.profiles.default_view IS 'User preference for default dashboard view (triathlon vs strength)';
