// ============================================================
// Tool: Update Daily Log
// Upserts a daily wellness log entry for the athlete
// ============================================================

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { upsertDailyLog } from '../supabase.js';

export function createUpdateSorenessTool(client: SupabaseClient, userId: string, clubId: string) {
    return tool(
        async (input: Record<string, string | number | undefined>) => {
            const date = input.date as string | undefined;
            const rpe = input.rpe as number | undefined;
            const mood = input.mood as number | undefined;
            const sleepHours = input.sleepHours as number | undefined;
            const sleepQuality = input.sleepQuality as number | undefined;
            const hrv = input.hrv as number | undefined;
            const restingHr = input.restingHr as number | undefined;
            const weightKg = input.weightKg as number | undefined;
            const notes = input.notes as string | undefined;

            const logDate = date ?? new Date().toISOString().split('T')[0];

            const log = await upsertDailyLog(client, {
                athlete_id: userId,
                club_id: clubId,
                log_date: logDate,
                rpe: rpe ?? null,
                mood: mood ?? null,
                sleep_hours: sleepHours ?? null,
                sleep_quality: sleepQuality ?? null,
                hrv: hrv ?? null,
                resting_hr: restingHr ?? null,
                weight_kg: weightKg ?? null,
                notes: notes ?? null,
            });

            return `Daily log updated for ${log.log_date}. Fields set: ${Object.entries({
                rpe,
                mood,
                sleepHours,
                sleepQuality,
                hrv,
                restingHr,
                weightKg,
            })
                .filter(([, v]) => v != null)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || 'notes only'}`;
        },
        {
            name: 'update_daily_log',
            description:
                'Updates or creates a daily wellness log entry. Use when the athlete reports sleep, mood, RPE, HRV, weight, or other daily metrics. Always confirm values before calling.',
            schema: z.object({
                date: z.string().optional().describe('Log date (YYYY-MM-DD), defaults to today'),
                rpe: z.number().optional().describe('Rate of Perceived Exertion (1-10)'),
                mood: z.number().optional().describe('Mood rating (1-5)'),
                sleepHours: z.number().optional().describe('Hours of sleep'),
                sleepQuality: z.number().optional().describe('Sleep quality (1-5)'),
                hrv: z.number().optional().describe('Heart rate variability'),
                restingHr: z.number().optional().describe('Resting heart rate'),
                weightKg: z.number().optional().describe('Body weight in kg'),
                notes: z.string().optional().describe('Additional notes'),
            }) as any,
        }
    );
}
