/**
 * Planned Workouts REST API — CRUD endpoints for the calendar UI.
 *
 * All routes are protected by JWT auth + claims extraction
 * (applied in server.ts for /api/* routes).
 */

import { Hono } from 'hono';
import { getAuth } from '../../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

export const plannedWorkoutsRoutes = new Hono();

// ── GET /api/planned-workouts ──────────────────────────────────
// Query params: from (ISO date), to (ISO date), status (optional)
plannedWorkoutsRoutes.get('/', async (c) => {
    const { userId, clubId } = getAuth(c);
    const from = c.req.query('from');
    const to = c.req.query('to');
    const status = c.req.query('status');

    if (!from || !to) {
        return c.json({ error: 'Missing required query params: from, to' }, 400);
    }

    const supabase = getSupabase();
    let query = supabase
        .from('planned_workouts')
        .select('*')
        .eq('athlete_id', userId)
        .eq('club_id', clubId)
        .gte('planned_date', from)
        .lte('planned_date', to)
        .order('planned_date', { ascending: true })
        .order('sort_order', { ascending: true });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Failed to fetch planned workouts:', error);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ data });
});

// ── GET /api/planned-workouts/:id ──────────────────────────────
plannedWorkoutsRoutes.get('/:id', async (c) => {
    const { userId } = getAuth(c);
    const id = c.req.param('id');
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('planned_workouts')
        .select('*')
        .eq('id', id)
        .eq('athlete_id', userId)
        .single();

    if (error || !data) {
        return c.json({ error: 'Planned workout not found' }, 404);
    }

    return c.json({ data });
});

// ── POST /api/planned-workouts ─────────────────────────────────
plannedWorkoutsRoutes.post('/', async (c) => {
    const { userId, clubId } = getAuth(c);
    const body = await c.req.json();

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('planned_workouts')
        .insert({
            athlete_id: userId,
            club_id: clubId,
            plan_id: body.planId || null,
            planned_date: body.plannedDate,
            planned_time: body.plannedTime || null,
            activity_type: body.activityType,
            title: body.title,
            description: body.description || null,
            duration_min: body.durationMin || null,
            distance_km: body.distanceKm || null,
            target_tss: body.targetTss || null,
            target_rpe: body.targetRpe || null,
            intensity: body.intensity || null,
            session_data: body.sessionData || {},
            status: 'planned',
            sort_order: body.sortOrder || 0,
            notes: body.notes || null,
            coach_notes: body.coachNotes || null,
            source: body.source || 'MANUAL',
        })
        .select()
        .single();

    if (error) {
        console.error('Failed to create planned workout:', error);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ data }, 201);
});

// ── PATCH /api/planned-workouts/:id ────────────────────────────
// Supports partial updates (drag-drop reschedule, inline edit)
plannedWorkoutsRoutes.patch('/:id', async (c) => {
    const { userId } = getAuth(c);
    const id = c.req.param('id');
    const body = await c.req.json();

    // Map camelCase to snake_case for the fields being updated
    const updateData: Record<string, unknown> = {};
    if (body.plannedDate !== undefined) updateData.planned_date = body.plannedDate;
    if (body.plannedTime !== undefined) updateData.planned_time = body.plannedTime;
    if (body.activityType !== undefined) updateData.activity_type = body.activityType;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.durationMin !== undefined) updateData.duration_min = body.durationMin;
    if (body.distanceKm !== undefined) updateData.distance_km = body.distanceKm;
    if (body.targetTss !== undefined) updateData.target_tss = body.targetTss;
    if (body.targetRpe !== undefined) updateData.target_rpe = body.targetRpe;
    if (body.intensity !== undefined) updateData.intensity = body.intensity;
    if (body.sessionData !== undefined) updateData.session_data = body.sessionData;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.sortOrder !== undefined) updateData.sort_order = body.sortOrder;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.coachNotes !== undefined) updateData.coach_notes = body.coachNotes;

    if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No fields to update' }, 400);
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('planned_workouts')
        .update(updateData)
        .eq('id', id)
        .eq('athlete_id', userId)
        .select()
        .single();

    if (error) {
        console.error('Failed to update planned workout:', error);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ data });
});

// ── PATCH /api/planned-workouts/:id/complete ───────────────────
// Mark as completed and optionally link to a workout record
plannedWorkoutsRoutes.patch('/:id/complete', async (c) => {
    const { userId } = getAuth(c);
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('planned_workouts')
        .update({
            status: 'completed',
            workout_id: body.workoutId || null,
        })
        .eq('id', id)
        .eq('athlete_id', userId)
        .select()
        .single();

    if (error) {
        console.error('Failed to complete planned workout:', error);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ data });
});

// ── DELETE /api/planned-workouts/:id ───────────────────────────
plannedWorkoutsRoutes.delete('/:id', async (c) => {
    const { userId } = getAuth(c);
    const id = c.req.param('id');

    const supabase = getSupabase();
    const { error } = await supabase
        .from('planned_workouts')
        .delete()
        .eq('id', id)
        .eq('athlete_id', userId);

    if (error) {
        console.error('Failed to delete planned workout:', error);
        return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true });
});
