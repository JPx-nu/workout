-- ============================================================
-- Migration: RLS policies + Custom Claims Auth Hook
-- ============================================================

-- ============================================================
-- Custom Claims Auth Hook
-- Injects club_id and role into JWT on every login
-- ============================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims jsonb;
  user_club_id uuid;
  user_role text;
BEGIN
  SELECT club_id, role INTO user_club_id, user_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_club_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,club_id}', to_jsonb(user_club_id::text));
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM public, anon, authenticated;

-- ============================================================
-- Helper: extract club_id from JWT
-- ============================================================
CREATE OR REPLACE FUNCTION public.requesting_club_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT ((auth.jwt()->'app_metadata'->>'club_id')::uuid);
$$;

-- ============================================================
-- RLS Policies
-- Pattern: club_id = requesting_club_id() on all tenant tables
-- ============================================================

-- Clubs
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own club" ON public.clubs FOR SELECT TO authenticated
  USING (id = public.requesting_club_id());

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see club members" ON public.profiles FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (club_id = public.requesting_club_id());

-- Workouts
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club workouts" ON public.workouts FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Insert own workouts" ON public.workouts FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND club_id = public.requesting_club_id());
CREATE POLICY "Update own workouts" ON public.workouts FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (club_id = public.requesting_club_id());

-- Daily Logs
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club logs" ON public.daily_logs FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Insert own logs" ON public.daily_logs FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND club_id = public.requesting_club_id());
CREATE POLICY "Update own logs" ON public.daily_logs FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (club_id = public.requesting_club_id());

-- Injuries
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club injuries" ON public.injuries FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Insert own injuries" ON public.injuries FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND club_id = public.requesting_club_id());

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club events" ON public.events FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Admins manage events" ON public.events FOR ALL TO authenticated
  USING (
    club_id = public.requesting_club_id()
    AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'owner', 'coach')
  );

-- Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club documents" ON public.documents FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (
    club_id = public.requesting_club_id()
    AND (auth.jwt()->'app_metadata'->>'role') IN ('admin', 'owner', 'coach')
  );

-- Document Chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());

-- KG Nodes
ALTER TABLE public.kg_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club KG nodes" ON public.kg_nodes FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());

-- KG Edges
ALTER TABLE public.kg_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club KG edges" ON public.kg_edges FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());

-- Training Plans
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own plans" ON public.training_plans FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() AND club_id = public.requesting_club_id());
CREATE POLICY "Coaches see plans" ON public.training_plans FOR SELECT TO authenticated
  USING (
    club_id = public.requesting_club_id()
    AND (auth.jwt()->'app_metadata'->>'role') IN ('coach', 'admin', 'owner')
  );

-- Health Metrics
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own metrics" ON public.health_metrics FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());
CREATE POLICY "Insert own metrics" ON public.health_metrics FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND club_id = public.requesting_club_id());

-- Conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own conversations" ON public.conversations FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());
CREATE POLICY "Create own conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid() AND club_id = public.requesting_club_id());

-- Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See own messages" ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE athlete_id = auth.uid()
    )
  );
CREATE POLICY "Insert own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE athlete_id = auth.uid()
    )
  );

-- Squads
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club squads" ON public.squads FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());

-- Squad Members
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club squad members" ON public.squad_members FOR SELECT TO authenticated
  USING (
    squad_id IN (
      SELECT id FROM public.squads WHERE club_id = public.requesting_club_id()
    )
  );

-- Relay Events
ALTER TABLE public.relay_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See club relays" ON public.relay_events FOR SELECT TO authenticated
  USING (club_id = public.requesting_club_id());

-- Baton Passes
ALTER TABLE public.baton_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See relay batons" ON public.baton_passes FOR SELECT TO authenticated
  USING (
    relay_id IN (
      SELECT id FROM public.relay_events WHERE club_id = public.requesting_club_id()
    )
  );
