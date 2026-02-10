-- ============================================================
-- Migration: Gamification tables (squads, relays, baton passes)
-- ============================================================

-- Squads
CREATE TABLE public.squads (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id),
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_squads_club ON public.squads(club_id);

-- Squad Members
CREATE TABLE public.squad_members (
  squad_id    uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id),
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (squad_id, athlete_id)
);

-- Relay Events
CREATE TABLE public.relay_events (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  squad_id          uuid NOT NULL REFERENCES public.squads(id),
  club_id           uuid NOT NULL REFERENCES public.clubs(id),
  status            text DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'cancelled')),
  goal_distance_m   real NOT NULL,
  total_distance_m  real DEFAULT 0,
  started_at        timestamptz DEFAULT now(),
  ended_at          timestamptz
);

CREATE INDEX idx_relay_events_squad ON public.relay_events(squad_id);
CREATE INDEX idx_relay_events_club ON public.relay_events(club_id);

-- Baton Passes
CREATE TABLE public.baton_passes (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  relay_id          uuid NOT NULL REFERENCES public.relay_events(id),
  from_athlete_id   uuid REFERENCES public.profiles(id),
  to_athlete_id     uuid NOT NULL REFERENCES public.profiles(id),
  distance_m        real NOT NULL,
  passed_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_baton_passes_relay ON public.baton_passes(relay_id);

-- ============================================================
-- Chat / Conversations
-- ============================================================

-- Conversations
CREATE TABLE public.conversations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id),
  club_id     uuid NOT NULL REFERENCES public.clubs(id),
  title       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_conversations_athlete ON public.conversations(athlete_id);

-- Messages
CREATE TABLE public.messages (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id   uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role              text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           text NOT NULL,
  metadata          jsonb DEFAULT '{}',
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
