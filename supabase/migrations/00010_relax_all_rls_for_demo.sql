-- Relax RLS policies that depend on requesting_club_id()
-- Since the custom_access_token_hook may not be enabled or the demo user
-- lacks a club_id in their profile, all policies using requesting_club_id()
-- fail. Replace club_id checks with athlete_id checks for user-owned tables.
-- For club-scoped tables, look up club_id from profiles table instead.

-- ═══════════════════════════════════════════════════════════════
-- WORKOUTS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "See club workouts" ON public.workouts;
CREATE POLICY "See own workouts" ON public.workouts FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Insert own workouts" ON public.workouts;
CREATE POLICY "Insert own workouts" ON public.workouts FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Update own workouts" ON public.workouts;
CREATE POLICY "Update own workouts" ON public.workouts FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- DAILY_LOGS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "See club logs" ON public.daily_logs;
CREATE POLICY "See own logs" ON public.daily_logs FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Insert own logs" ON public.daily_logs;
CREATE POLICY "Insert own logs" ON public.daily_logs FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Update own logs" ON public.daily_logs;
CREATE POLICY "Update own logs" ON public.daily_logs FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- INJURIES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "See club injuries" ON public.injuries;
CREATE POLICY "See own injuries" ON public.injuries FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Insert own injuries" ON public.injuries;
CREATE POLICY "Insert own injuries" ON public.injuries FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- HEALTH_METRICS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Insert own metrics" ON public.health_metrics;
CREATE POLICY "Insert own metrics" ON public.health_metrics FOR INSERT TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- TRAINING_PLANS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "See own plans" ON public.training_plans;
CREATE POLICY "See own plans" ON public.training_plans FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

DROP POLICY IF EXISTS "Coaches see plans" ON public.training_plans;
CREATE POLICY "Coaches see plans" ON public.training_plans FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('coach', 'admin', 'owner')
  );

-- ═══════════════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users see club members" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- CLUBS
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users see their own club" ON public.clubs;
CREATE POLICY "Users see their own club" ON public.clubs FOR SELECT TO authenticated
  USING (
    id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- READ-ONLY CLUB-SCOPED TABLES
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "See club documents" ON public.documents;
CREATE POLICY "See club documents" ON public.documents FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See club chunks" ON public.document_chunks;
CREATE POLICY "See club chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See club KG nodes" ON public.kg_nodes;
CREATE POLICY "See club KG nodes" ON public.kg_nodes FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See club KG edges" ON public.kg_edges;
CREATE POLICY "See club KG edges" ON public.kg_edges FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See club events" ON public.events;
CREATE POLICY "See club events" ON public.events FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events FOR ALL TO authenticated
  USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner', 'coach')
  );

DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (
    club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'owner', 'coach')
  );

DROP POLICY IF EXISTS "See club squads" ON public.squads;
CREATE POLICY "See club squads" ON public.squads FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See club squad members" ON public.squad_members;
CREATE POLICY "See club squad members" ON public.squad_members FOR SELECT TO authenticated
  USING (squad_id IN (
    SELECT id FROM squads WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  ));

DROP POLICY IF EXISTS "See club relays" ON public.relay_events;
CREATE POLICY "See club relays" ON public.relay_events FOR SELECT TO authenticated
  USING (club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "See relay batons" ON public.baton_passes;
CREATE POLICY "See relay batons" ON public.baton_passes FOR SELECT TO authenticated
  USING (relay_id IN (
    SELECT id FROM relay_events WHERE club_id IN (SELECT club_id FROM profiles WHERE id = auth.uid())
  ));
