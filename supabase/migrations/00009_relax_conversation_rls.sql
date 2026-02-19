-- Relax conversation INSERT/UPDATE policies to only check athlete_id
-- Conversations are personal to the athlete, not club-scoped
-- The previous policy required club_id = requesting_club_id(), which fails
-- when the custom_access_token_hook isn't configured or the user's profile
-- lacks a club_id.

-- Drop the existing policy that requires club_id match
DROP POLICY IF EXISTS "Create own conversations" ON public.conversations;

-- Re-create with only athlete_id check (no club_id requirement)
CREATE POLICY "Create own conversations" ON public.conversations 
  FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()));

-- Add an UPDATE policy so conversation titles can be updated
DROP POLICY IF EXISTS "Update own conversations" ON public.conversations;
CREATE POLICY "Update own conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (athlete_id = (select auth.uid()));
