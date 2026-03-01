-- ============================================================
-- Migration: Add missing FK and RLS query indexes
--
-- FK indexes: training_plans.event_id, planned_workouts.workout_id
-- RLS indexes: conversations.athlete_id, messages.conversation_id
-- Without these, JOINs and RLS subqueries do sequential scans.
-- ============================================================

-- FK indexes for JOINs
CREATE INDEX IF NOT EXISTS idx_training_plans_event_id
  ON public.training_plans(event_id);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_workout_id
  ON public.planned_workouts(workout_id);

-- RLS subquery indexes (used in every authenticated request)
CREATE INDEX IF NOT EXISTS idx_conversations_athlete_id
  ON public.conversations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);
