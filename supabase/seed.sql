-- ============================================================
-- Seed data for testing the AI Coach
-- User: test@example.com
-- Password: password123
-- ============================================================
-- Enable pgcrypto for password hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- 1. Create a Test Club
INSERT INTO public.clubs (id, name, slug)
VALUES (
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        'Ironman Mastery Squad',
        'ironman-mastery'
    ) ON CONFLICT (id) DO NOTHING;
-- 2. Create the Auth User (this triggers profile creation via on_auth_user_created)
INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    )
VALUES (
        '00000000-0000-0000-0000-000000000000',
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'authenticated',
        'authenticated',
        'test@example.com',
        crypt('password123', gen_salt('bf')),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        '{"display_name": "Test Athlete", "club_id": "c1f7b8d4-5316-4186-b413-568eb2af1a80"}',
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- Wait a tiny bit (not strictly needed in standard SQL script if trigger runs synchronously, which it does in Postgres)
-- The profile will be created automatically. Let's update it if needed.
UPDATE public.profiles
SET timezone = 'Europe/Stockholm',
    role = 'athlete'
WHERE id = 'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b';
-- 3. Add Some Workouts for the AI to "see"
INSERT INTO public.workouts (
        id,
        athlete_id,
        club_id,
        activity_type,
        source,
        started_at,
        duration_s,
        distance_m,
        avg_hr,
        max_hr,
        tss,
        notes
    )
VALUES (
        uuid_generate_v4(),
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        'RUN',
        'GARMIN',
        now() - interval '2 days',
        3600,
        10000,
        145,
        160,
        60.5,
        'Felt great today, nice easy pace.'
    ),
    (
        uuid_generate_v4(),
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        'BIKE',
        'WAHOO',
        now() - interval '4 days',
        7200,
        60000,
        135,
        175,
        110.2,
        'Hard intervals on the trainer.'
    );
-- 4. Add Daily Logs for Health Metrics
INSERT INTO public.daily_logs (
        athlete_id,
        club_id,
        log_date,
        sleep_hours,
        sleep_quality,
        rpe,
        mood,
        hrv,
        resting_hr,
        weight_kg
    )
VALUES (
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        current_date - interval '1 day',
        7.5,
        8,
        4,
        8,
        55.2,
        48,
        75.0
    ),
    (
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        current_date - interval '2 days',
        6.0,
        5,
        7,
        5,
        42.1,
        52,
        75.2
    );
-- 5. Add an Active Injury
INSERT INTO public.injuries (
        id,
        athlete_id,
        club_id,
        body_part,
        severity,
        reported_at,
        notes
    )
VALUES (
        uuid_generate_v4(),
        'd4f6c4d4-20a2-4a0b-930b-5b5ea5dc235b',
        'c1f7b8d4-5316-4186-b413-568eb2af1a80',
        'Left Knee',
        4,
        now() - interval '5 days',
        'Slight pain below the kneecap after long run.'
    );