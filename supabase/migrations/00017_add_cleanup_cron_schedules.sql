-- ============================================================
-- Migration: Schedule cleanup jobs via pg_cron
--
-- Schedules periodic cleanup of completed webhook queue entries
-- (older than 7 days) and expired rate limit windows.
--
-- Wrapped in availability check so local dev environments
-- without pg_cron don't fail.
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;

        -- Clean completed/dead webhook jobs daily at 03:00 UTC
        PERFORM cron.schedule(
            'cleanup-webhook-queue',
            '0 3 * * *',
            'SELECT public.cleanup_webhook_queue()'
        );

        -- Clean expired rate limit windows every 5 minutes
        PERFORM cron.schedule(
            'cleanup-rate-limits',
            '*/5 * * * *',
            'SELECT public.cleanup_rate_limits()'
        );

        RAISE NOTICE 'pg_cron cleanup jobs scheduled';
    ELSE
        RAISE NOTICE 'pg_cron not available — skipping cleanup job scheduling';
    END IF;
END;
$$;
