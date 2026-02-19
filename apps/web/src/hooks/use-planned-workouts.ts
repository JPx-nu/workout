/**
 * use-planned-workouts — Fetches planned workouts for a date range
 * from the REST API. Used by the training calendar to display events.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/supabase-provider';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export interface PlannedWorkout {
    id: string;
    athleteId: string;
    planId: string | null;
    plannedDate: string;        // YYYY-MM-DD
    plannedTime: string | null; // HH:MM
    activityType: string;
    title: string;
    description: string | null;
    durationMin: number | null;
    distanceKm: number | null;
    targetTss: number | null;
    targetRpe: number | null;
    intensity: string | null;
    sessionData: Record<string, unknown>;
    status: string;
    sortOrder: number;
    notes: string | null;
    coachNotes: string | null;
    source: string;
    workoutId: string | null;
    createdAt: string;
    updatedAt: string;
}

// Snake → camelCase mapper for DB rows
function mapRow(row: Record<string, unknown>): PlannedWorkout {
    return {
        id: row.id as string,
        athleteId: row.athlete_id as string,
        planId: row.plan_id as string | null,
        plannedDate: row.planned_date as string,
        plannedTime: row.planned_time as string | null,
        activityType: row.activity_type as string,
        title: row.title as string,
        description: row.description as string | null,
        durationMin: row.duration_min as number | null,
        distanceKm: row.distance_km as number | null,
        targetTss: row.target_tss as number | null,
        targetRpe: row.target_rpe as number | null,
        intensity: row.intensity as string | null,
        sessionData: (row.session_data as Record<string, unknown>) || {},
        status: row.status as string,
        sortOrder: row.sort_order as number,
        notes: row.notes as string | null,
        coachNotes: row.coach_notes as string | null,
        source: row.source as string,
        workoutId: row.workout_id as string | null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

export function usePlannedWorkouts(from: string, to: string) {
    const { session } = useAuth();
    const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkouts = useCallback(async () => {
        if (!session?.access_token || !from || !to) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `${API_URL}/api/planned-workouts?from=${from}&to=${to}`,
                {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.status}`);
            }

            const json = await res.json();
            setWorkouts((json.data || []).map(mapRow));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch workouts');
        } finally {
            setIsLoading(false);
        }
    }, [session?.access_token, from, to]);

    useEffect(() => {
        fetchWorkouts();
    }, [fetchWorkouts]);

    // ── Mutations ──────────────────────────────────────────────

    const updateWorkout = useCallback(async (
        id: string,
        updates: Partial<Omit<PlannedWorkout, 'id' | 'athleteId' | 'createdAt' | 'updatedAt'>>
    ) => {
        if (!session?.access_token) return;

        try {
            const res = await fetch(`${API_URL}/api/planned-workouts/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!res.ok) throw new Error(`Update failed: ${res.status}`);

            const json = await res.json();
            const updated = mapRow(json.data);

            // Optimistic update
            setWorkouts(prev => prev.map(w => w.id === id ? updated : w));
            return updated;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    }, [session?.access_token]);

    const deleteWorkout = useCallback(async (id: string) => {
        if (!session?.access_token) return;

        try {
            const res = await fetch(`${API_URL}/api/planned-workouts/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

            setWorkouts(prev => prev.filter(w => w.id !== id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    }, [session?.access_token]);

    return {
        workouts,
        isLoading,
        error,
        refetch: fetchWorkouts,
        updateWorkout,
        deleteWorkout,
    };
}
