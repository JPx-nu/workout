// ============================================================
// Tool: Log Workout
// Inserts a new workout record for the athlete.
// For STRENGTH workouts, stores structured exercise data
// (exercises → sets → reps/weight/RPE) in the raw_data JSONB column.
// ============================================================

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertWorkout } from '../supabase.js';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { AI_CONFIG } from '../../../config/ai.js';

// ── Zod schemas for structured strength data ──────────────────

const setSchema = z.object({
    reps: z.number().describe('Number of reps performed'),
    weight_kg: z.number().describe('Weight in kg'),
    rpe: z.number().min(1).max(10).optional().describe('Rate of Perceived Exertion (1-10). 10 = absolute max effort'),
    rir: z.number().min(0).max(5).optional().describe('Reps In Reserve (0-5). 0 = failure'),
    tempo: z.string().optional().describe('Tempo notation e.g. "3-1-2-0" (eccentric-pause-concentric-pause in seconds)'),
    set_type: z
        .enum(['working', 'warmup', 'dropset', 'backoff', 'amrap', 'cluster'])
        .optional()
        .default('working')
        .describe('Type of this set. Default is "working"'),
});

const exerciseSchema = z.object({
    name: z.string().describe('Exercise name e.g. "Barbell Back Squat", "Dumbbell Bench Press"'),
    sets: z.array(setSchema).describe('Array of sets performed for this exercise'),
    group_id: z.number().optional().describe('Group number for supersets/circuits. Exercises with the same group_id are grouped together'),
    group_type: z
        .enum(['superset', 'circuit', 'giant_set'])
        .optional()
        .describe('Type of exercise grouping, if this exercise is part of a group'),
    notes: z.string().optional().describe('Exercise-specific notes e.g. "felt tight in left shoulder"'),
});

const workoutLogSchema = z.object({
    activityType: z.string().describe('Activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER'),
    startedAt: z.string().optional().describe('Start date/time in ISO 8601 (defaults to now)'),
    durationMin: z.number().optional().describe('Total workout duration in minutes'),
    distanceKm: z.number().optional().describe('Distance in kilometers (for cardio workouts)'),
    avgHr: z.number().optional().describe('Average heart rate'),
    tss: z.number().optional().describe('Training Stress Score'),
    notes: z.string().optional().describe('General workout notes'),
    exercises: z
        .array(exerciseSchema)
        .optional()
        .describe('Structured exercise data for STRENGTH workouts. Include exercises with their sets, reps, and weights.'),
});

// ── Tool factory ──────────────────────────────────────────────

export function createLogWorkoutTool(client: SupabaseClient, userId: string, clubId: string) {
    return tool(
        async (input: z.infer<typeof workoutLogSchema>) => {
            const startedAt = input.startedAt ?? new Date().toISOString();

            // Build raw_data for strength workouts
            const rawData =
                input.exercises && input.exercises.length > 0
                    ? { exercises: input.exercises, metadata: { source: 'COACH', schema_version: 2 } }
                    : null;

            // Generate embedding for natural language search
            let embedding: number[] | undefined;
            if (input.notes || rawData?.exercises) {
                try {
                    const textToEmbed = `Activity: ${input.activityType}. Notes: ${input.notes ?? 'None'}. Ex: ${rawData?.exercises ? JSON.stringify(rawData.exercises) : 'None'
                        }`;
                    const embeddingsModel = new AzureOpenAIEmbeddings({
                        azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
                        azureOpenAIApiInstanceName: AI_CONFIG.azure.endpoint.split('.')[0].replace('https://', ''),
                        azureOpenAIApiDeploymentName: AI_CONFIG.azure.embeddingsDeployment,
                        azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
                    });
                    embedding = await embeddingsModel.embedQuery(textToEmbed);
                } catch (err) {
                    console.error('Failed to generate embedding for workout', err);
                }
            }

            const workout = await insertWorkout(client, {
                athlete_id: userId,
                club_id: clubId,
                activity_type: input.activityType,
                source: 'MANUAL',
                started_at: startedAt,
                duration_s: input.durationMin ? input.durationMin * 60 : null,
                distance_m: input.distanceKm ? input.distanceKm * 1000 : null,
                avg_hr: input.avgHr ?? null,
                max_hr: null,
                avg_pace_s_km: null,
                avg_power_w: null,
                calories: null,
                tss: input.tss ?? null,
                raw_data: rawData,
                notes: input.notes ?? null,
                embedding: embedding,
            });

            // Build response with exercise summary for STRENGTH workouts
            if (rawData?.exercises) {
                const exerciseLines = rawData.exercises.map((ex: z.infer<typeof exerciseSchema>) => {
                    const workingSets = ex.sets.filter((s) => s.set_type !== 'warmup');
                    const totalVol = workingSets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
                    return `  - ${ex.name}: ${workingSets.length} working sets, ${totalVol} kg total volume`;
                });
                return `Workout logged successfully (ID: ${workout.id}).\nActivity: ${workout.activity_type}, Date: ${workout.started_at}\n\nExercises logged:\n${exerciseLines.join('\n')}\n\nNow retrieve workout history to compare this session against recent ones.`;
            }

            return `Workout logged successfully (ID: ${workout.id}). Activity: ${workout.activity_type}, Date: ${workout.started_at}`;
        },
        {
            name: 'log_workout',
            description:
                'Logs a new workout for the athlete. For STRENGTH workouts, include structured exercise data (exercises with sets, reps, weight, RPE). Always confirm details with the athlete before calling this tool.',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            schema: workoutLogSchema as any,
        }
    );
}
