// ============================================================
// Tool: Get Workout History
// Fetches recent workouts with optional filters
// ============================================================

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkouts } from '../supabase.js';

export function createGetWorkoutHistoryTool(client: SupabaseClient, userId: string) {
    return tool(
        async ({ activityType, fromDate, toDate, limit }: Record<string, string | number | undefined>) => {
            const workouts = await getWorkouts(client, userId, {
                activityType: activityType as string | undefined,
                fromDate: fromDate as string | undefined,
                toDate: toDate as string | undefined,
                limit: (limit as number | undefined) ?? 10,
            });

            if (!workouts.length) return 'No workouts found for the given filters.';

            return JSON.stringify(
                workouts.map((w) => ({
                    date: w.started_at,
                    activityType: w.activity_type,
                    durationMin: w.duration_s ? Math.round(w.duration_s / 60) : null,
                    distanceKm: w.distance_m ? +(w.distance_m / 1000).toFixed(2) : null,
                    avgHr: w.avg_hr,
                    maxHr: w.max_hr,
                    avgPower: w.avg_power_w,
                    tss: w.tss,
                    notes: w.notes,
                }))
            );
        },
        {
            name: 'get_workout_history',
            description:
                'Retrieves recent workouts for the athlete. Use when asked about specific sessions. Supports filtering by date range and activity type.',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schema: z.object({
                activityType: z.string().optional().describe('Filter by activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER'),
                fromDate: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
                toDate: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
                limit: z.number().optional().describe('Max workouts to return (default 10, max 50)'),
            }) as any,
        }
    );
}
