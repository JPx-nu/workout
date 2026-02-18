// ============================================================
// Tool: Log Workout
// Inserts a new workout record for the athlete
// ============================================================

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertWorkout } from '../supabase.js';

export function createLogWorkoutTool(client: SupabaseClient, userId: string, clubId: string) {
    return tool(
        async (input: Record<string, string | number | undefined>) => {
            const activityType = input.activityType as string;
            const startedAt = (input.startedAt as string | undefined) ?? new Date().toISOString();
            const durationMin = input.durationMin as number | undefined;
            const distanceKm = input.distanceKm as number | undefined;
            const avgHr = input.avgHr as number | undefined;
            const tss = input.tss as number | undefined;
            const notes = input.notes as string | undefined;

            const workout = await insertWorkout(client, {
                athlete_id: userId,
                club_id: clubId,
                activity_type: activityType,
                source: 'COACH',
                started_at: startedAt,
                duration_s: durationMin ? durationMin * 60 : null,
                distance_m: distanceKm ? distanceKm * 1000 : null,
                avg_hr: avgHr ?? null,
                max_hr: null,
                avg_pace_s_km: null,
                avg_power_w: null,
                calories: null,
                tss: tss ?? null,
                raw_data: null,
                notes: notes ?? null,
            });

            return `Workout logged successfully (ID: ${workout.id}). Activity: ${workout.activity_type}, Date: ${workout.started_at}`;
        },
        {
            name: 'log_workout',
            description:
                'Logs a new workout for the athlete. Always confirm details with the athlete before calling this tool.',
            schema: z.object({
                activityType: z.string().describe('Activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER'),
                startedAt: z.string().optional().describe('Start date/time in ISO 8601 (defaults to now)'),
                durationMin: z.number().optional().describe('Duration in minutes'),
                distanceKm: z.number().optional().describe('Distance in kilometers'),
                avgHr: z.number().optional().describe('Average heart rate'),
                tss: z.number().optional().describe('Training Stress Score'),
                notes: z.string().optional().describe('Workout notes'),
            }) as any,
        }
    );
}
