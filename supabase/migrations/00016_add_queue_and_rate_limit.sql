-- ============================================================
-- Migration: Persistent Webhook Queue + Distributed Rate Limiting
--
-- Replaces in-memory queue (loses data on restart) and
-- in-memory rate limiter (per-instance only) with
-- PostgreSQL-backed implementations.
-- ============================================================

-- ── Webhook Queue ─────────────────────────────────────────────
-- Simple durable queue table. Jobs are claimed via
-- UPDATE ... SET status = 'processing' with a visibility timeout.
-- Failed jobs auto-retry (status reverts after vt expires).

CREATE TABLE IF NOT EXISTS public.webhook_queue (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider        text NOT NULL,
    event_data      jsonb NOT NULL,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
    attempts        int NOT NULL DEFAULT 0,
    max_attempts    int NOT NULL DEFAULT 3,
    visible_after   timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    error_message   text
);

-- Index for the queue polling query: find pending jobs that are visible
CREATE INDEX IF NOT EXISTS idx_webhook_queue_poll
    ON public.webhook_queue (visible_after)
    WHERE status IN ('pending', 'processing');

-- Function: claim the next N visible jobs atomically
CREATE OR REPLACE FUNCTION public.claim_webhook_jobs(
    batch_size int DEFAULT 5,
    visibility_timeout_seconds int DEFAULT 30
)
RETURNS SETOF public.webhook_queue
LANGUAGE sql
AS $$
    UPDATE public.webhook_queue
    SET status = 'processing',
        visible_after = now() + (visibility_timeout_seconds || ' seconds')::interval,
        attempts = attempts + 1
    WHERE id IN (
        SELECT id FROM public.webhook_queue
        WHERE status IN ('pending')
          AND visible_after <= now()
        ORDER BY created_at
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
$$;

-- Function: mark a job as completed
CREATE OR REPLACE FUNCTION public.complete_webhook_job(job_id bigint)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE public.webhook_queue
    SET status = 'completed', completed_at = now()
    WHERE id = job_id;
$$;

-- Function: mark a job as failed (retries or moves to dead)
CREATE OR REPLACE FUNCTION public.fail_webhook_job(
    job_id bigint,
    err_msg text DEFAULT NULL,
    retry_delay_seconds int DEFAULT 5
)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE public.webhook_queue
    SET status = CASE
            WHEN attempts >= max_attempts THEN 'dead'
            ELSE 'pending'
        END,
        visible_after = CASE
            WHEN attempts >= max_attempts THEN visible_after
            ELSE now() + (retry_delay_seconds || ' seconds')::interval
        END,
        error_message = COALESCE(err_msg, error_message)
    WHERE id = job_id;
$$;

-- Cleanup: remove completed jobs older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_webhook_queue()
RETURNS int
LANGUAGE sql
AS $$
    WITH deleted AS (
        DELETE FROM public.webhook_queue
        WHERE status IN ('completed', 'dead')
          AND created_at < now() - interval '7 days'
        RETURNING 1
    )
    SELECT count(*)::int FROM deleted;
$$;

-- ── Rate Limiting ─────────────────────────────────────────────
-- Sliding window counters backed by PostgreSQL.
-- Works across multiple API instances (distributed).

CREATE TABLE IF NOT EXISTS public.rate_limit_windows (
    key             text NOT NULL,
    window_start    timestamptz NOT NULL,
    request_count   int NOT NULL DEFAULT 1,
    PRIMARY KEY (key, window_start)
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup
    ON public.rate_limit_windows (window_start);

-- Function: check and increment rate limit atomically
-- Returns: remaining requests (negative = over limit)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    rate_key text,
    max_requests int,
    window_seconds int
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
    current_window timestamptz;
    current_count int;
BEGIN
    -- Calculate current window start (truncated to window_seconds boundary)
    current_window := to_timestamp(
        floor(extract(epoch FROM now()) / window_seconds) * window_seconds
    );

    -- Upsert: increment counter or create new entry
    INSERT INTO public.rate_limit_windows (key, window_start, request_count)
    VALUES (rate_key, current_window, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET request_count = rate_limit_windows.request_count + 1
    RETURNING request_count INTO current_count;

    -- Return remaining (negative means over limit)
    RETURN max_requests - current_count;
END;
$$;

-- Cleanup: remove expired rate limit windows
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS int
LANGUAGE sql
AS $$
    WITH deleted AS (
        DELETE FROM public.rate_limit_windows
        WHERE window_start < now() - interval '5 minutes'
        RETURNING 1
    )
    SELECT count(*)::int FROM deleted;
$$;

-- ── RLS ───────────────────────────────────────────────────────
-- These tables are only accessed by the service role key, not end users.
ALTER TABLE public.webhook_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_windows ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_webhook_queue" ON public.webhook_queue
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_rate_limits" ON public.rate_limit_windows
    FOR ALL USING (true) WITH CHECK (true);
