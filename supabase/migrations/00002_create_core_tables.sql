-- ============================================================
-- Migration: Core tables (clubs, profiles, workouts, daily_logs, injuries)
-- ============================================================

-- Clubs (multi-tenant root)
CREATE TABLE public.clubs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  settings    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id       uuid NOT NULL REFERENCES public.clubs(id),
  role          text NOT NULL DEFAULT 'athlete'
                CHECK (role IN ('athlete', 'coach', 'admin', 'owner')),
  display_name  text,
  avatar_url    text,
  timezone      text DEFAULT 'UTC',
  preferences   jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_profiles_club_id ON public.profiles(club_id);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, club_id, display_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'club_id')::uuid, NULL),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Events (races)
CREATE TABLE public.events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  name            text NOT NULL,
  event_date      date NOT NULL,
  location        text,
  distance_type   text CHECK (distance_type IN (
    'SPRINT', 'OLYMPIC', 'HALF_IRONMAN', 'IRONMAN', 'CUSTOM'
  )),
  details         jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_events_club_id ON public.events(club_id);

-- Workouts (normalized from all sources)
CREATE TABLE public.workouts (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id      uuid NOT NULL REFERENCES public.profiles(id),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  activity_type   text NOT NULL CHECK (activity_type IN (
    'SWIM', 'BIKE', 'RUN', 'STRENGTH', 'YOGA', 'OTHER'
  )),
  source          text NOT NULL CHECK (source IN (
    'GARMIN', 'POLAR', 'WAHOO', 'FORM', 'MANUAL', 'HEALTHKIT', 'HEALTH_CONNECT'
  )),
  started_at      timestamptz NOT NULL,
  duration_s      integer,
  distance_m      real,
  avg_hr          smallint,
  max_hr          smallint,
  avg_pace_s_km   real,
  avg_power_w     real,
  calories        integer,
  tss             real,
  raw_data        jsonb,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_workouts_athlete ON public.workouts(athlete_id);
CREATE INDEX idx_workouts_club ON public.workouts(club_id);
CREATE INDEX idx_workouts_started ON public.workouts(started_at DESC);

-- Daily Logs
CREATE TABLE public.daily_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id      uuid NOT NULL REFERENCES public.profiles(id),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  log_date        date NOT NULL,
  sleep_hours     real,
  sleep_quality   smallint CHECK (sleep_quality BETWEEN 1 AND 10),
  rpe             smallint CHECK (rpe BETWEEN 1 AND 10),
  mood            smallint CHECK (mood BETWEEN 1 AND 10),
  hrv             real,
  resting_hr      smallint,
  weight_kg       real,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(athlete_id, log_date)
);

CREATE INDEX idx_daily_logs_athlete ON public.daily_logs(athlete_id);
CREATE INDEX idx_daily_logs_club ON public.daily_logs(club_id);

-- Injuries
CREATE TABLE public.injuries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id      uuid NOT NULL REFERENCES public.profiles(id),
  club_id         uuid NOT NULL REFERENCES public.clubs(id),
  body_part       text NOT NULL,
  severity        smallint CHECK (severity BETWEEN 1 AND 5),
  reported_at     timestamptz DEFAULT now(),
  resolved_at     timestamptz,
  notes           text
);

CREATE INDEX idx_injuries_athlete ON public.injuries(athlete_id);

-- Training Plans
CREATE TABLE public.training_plans (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id),
  club_id     uuid NOT NULL REFERENCES public.clubs(id),
  event_id    uuid REFERENCES public.events(id),
  name        text NOT NULL,
  status      text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  plan_data   jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_training_plans_athlete ON public.training_plans(athlete_id);

-- Health Metrics (HealthKit / Health Connect)
CREATE TABLE public.health_metrics (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id    uuid NOT NULL REFERENCES public.profiles(id),
  club_id       uuid NOT NULL REFERENCES public.clubs(id),
  metric_type   text NOT NULL CHECK (metric_type IN (
    'SLEEP_HOURS', 'SLEEP_STAGES', 'HRV', 'RESTING_HR',
    'SPO2', 'STEPS', 'ACTIVE_CALORIES', 'VO2MAX'
  )),
  value         real NOT NULL,
  unit          text,
  recorded_at   timestamptz NOT NULL,
  source        text CHECK (source IN ('HEALTHKIT', 'HEALTH_CONNECT', 'MANUAL')),
  raw_data      jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_health_metrics_athlete ON public.health_metrics(athlete_id);
CREATE INDEX idx_health_metrics_recorded ON public.health_metrics(recorded_at DESC);
