-- ============================================================
-- Migration 00006: Optimize RLS Performance
--
-- Wraps all bare auth.uid() and public.requesting_club_id()
-- calls in (select ...) subqueries so Postgres evaluates them
-- once per query instead of once per row.
--
-- @see https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================

-- ── Profiles ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (club_id = (select public.requesting_club_id()));

-- ── Workouts ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club workouts" ON public.workouts;
CREATE POLICY "See club workouts" ON public.workouts FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Insert own workouts" ON public.workouts;
CREATE POLICY "Insert own workouts" ON public.workouts FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Update own workouts" ON public.workouts;
CREATE POLICY "Update own workouts" ON public.workouts FOR UPDATE TO authenticated
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (club_id = (select public.requesting_club_id()));

-- ── Daily Logs ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club logs" ON public.daily_logs;
CREATE POLICY "See club logs" ON public.daily_logs FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Insert own logs" ON public.daily_logs;
CREATE POLICY "Insert own logs" ON public.daily_logs FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Update own logs" ON public.daily_logs;
CREATE POLICY "Update own logs" ON public.daily_logs FOR UPDATE TO authenticated
  USING (athlete_id = (select auth.uid()))
  WITH CHECK (club_id = (select public.requesting_club_id()));

-- ── Injuries ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club injuries" ON public.injuries;
CREATE POLICY "See club injuries" ON public.injuries FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Insert own injuries" ON public.injuries;
CREATE POLICY "Insert own injuries" ON public.injuries FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

-- ── Events ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club events" ON public.events;
CREATE POLICY "See club events" ON public.events FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events FOR ALL TO authenticated
  USING (
    club_id = (select public.requesting_club_id())
    AND ((select auth.jwt())->'app_metadata'->>'role') IN ('admin', 'owner', 'coach')
  );

-- ── Documents ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club documents" ON public.documents;
CREATE POLICY "See club documents" ON public.documents FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (
    club_id = (select public.requesting_club_id())
    AND ((select auth.jwt())->'app_metadata'->>'role') IN ('admin', 'owner', 'coach')
  );

-- ── Document Chunks ────────────────────────────────────────────

DROP POLICY IF EXISTS "See club chunks" ON public.document_chunks;
CREATE POLICY "See club chunks" ON public.document_chunks FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

-- ── KG Nodes ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club KG nodes" ON public.kg_nodes;
CREATE POLICY "See club KG nodes" ON public.kg_nodes FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

-- ── KG Edges ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club KG edges" ON public.kg_edges;
CREATE POLICY "See club KG edges" ON public.kg_edges FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

-- ── Training Plans ─────────────────────────────────────────────

DROP POLICY IF EXISTS "See own plans" ON public.training_plans;
CREATE POLICY "See own plans" ON public.training_plans FOR SELECT TO authenticated
  USING (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

DROP POLICY IF EXISTS "Coaches see plans" ON public.training_plans;
CREATE POLICY "Coaches see plans" ON public.training_plans FOR SELECT TO authenticated
  USING (
    club_id = (select public.requesting_club_id())
    AND ((select auth.jwt())->'app_metadata'->>'role') IN ('coach', 'admin', 'owner')
  );

-- ── Health Metrics ─────────────────────────────────────────────

DROP POLICY IF EXISTS "See own metrics" ON public.health_metrics;
CREATE POLICY "See own metrics" ON public.health_metrics FOR SELECT TO authenticated
  USING (athlete_id = (select auth.uid()));

DROP POLICY IF EXISTS "Insert own metrics" ON public.health_metrics;
CREATE POLICY "Insert own metrics" ON public.health_metrics FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

-- ── Conversations ──────────────────────────────────────────────

DROP POLICY IF EXISTS "See own conversations" ON public.conversations;
CREATE POLICY "See own conversations" ON public.conversations FOR SELECT TO authenticated
  USING (athlete_id = (select auth.uid()));

DROP POLICY IF EXISTS "Create own conversations" ON public.conversations;
CREATE POLICY "Create own conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (athlete_id = (select auth.uid()) AND club_id = (select public.requesting_club_id()));

-- ── Messages ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "See own messages" ON public.messages;
CREATE POLICY "See own messages" ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE athlete_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Insert own messages" ON public.messages;
CREATE POLICY "Insert own messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations WHERE athlete_id = (select auth.uid())
    )
  );

-- ── Clubs ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users see their own club" ON public.clubs;
CREATE POLICY "Users see their own club" ON public.clubs FOR SELECT TO authenticated
  USING (id = (select public.requesting_club_id()));

-- ── Squads ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "See club squads" ON public.squads;
CREATE POLICY "See club squads" ON public.squads FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

-- ── Squad Members ──────────────────────────────────────────────

DROP POLICY IF EXISTS "See club squad members" ON public.squad_members;
CREATE POLICY "See club squad members" ON public.squad_members FOR SELECT TO authenticated
  USING (
    squad_id IN (
      SELECT id FROM public.squads WHERE club_id = (select public.requesting_club_id())
    )
  );

-- ── Relay Events ───────────────────────────────────────────────

DROP POLICY IF EXISTS "See club relays" ON public.relay_events;
CREATE POLICY "See club relays" ON public.relay_events FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));

-- ── Baton Passes ───────────────────────────────────────────────

DROP POLICY IF EXISTS "See relay batons" ON public.baton_passes;
CREATE POLICY "See relay batons" ON public.baton_passes FOR SELECT TO authenticated
  USING (
    relay_id IN (
      SELECT id FROM public.relay_events WHERE club_id = (select public.requesting_club_id())
    )
  );

-- ── Profiles (read) ───────────────────────────────────────────

DROP POLICY IF EXISTS "Users see club members" ON public.profiles;
CREATE POLICY "Users see club members" ON public.profiles FOR SELECT TO authenticated
  USING (club_id = (select public.requesting_club_id()));
