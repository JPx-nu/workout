-- ============================================================
-- Migration: Fix RLS and reload schema for default_view
-- ============================================================

-- Force reload schema cache for PostgREST to pick up new column
NOTIFY pgrst, 'reload schema';

-- Ensure authenticated users can update their profile (all columns)
-- If policy already exists, this might be redundant or error if duplicate name.
-- Using DO block to safely handle if needed, or simple standard policy update.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

-- Grant UPDATE on the new column specifically if needed?
-- Usually GRANT UPDATE ON TABLE is enough.
GRANT UPDATE (default_view) ON TABLE public.profiles TO authenticated;
