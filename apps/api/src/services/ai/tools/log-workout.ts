// ============================================================
// Tool: Log Workout
// Inserts a new workout record for the athlete.
// For STRENGTH workouts, stores structured exercise data
// (exercises → sets → reps/weight/RPE) in the raw_data JSONB column.
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
	buildStrengthSessionFromLegacyInput,
	createCompletedWorkout,
} from "../../workout-center.js";

// ── Zod schemas for structured strength data ──────────────────

const setSchema = z.object({
	reps: z.number().describe("Number of reps performed"),
	weight_kg: z.number().describe("Weight in kg"),
	rpe: z
		.number()
		.min(1)
		.max(10)
		.optional()
		.describe("Rate of Perceived Exertion (1-10). 10 = absolute max effort"),
	rir: z.number().min(0).max(5).optional().describe("Reps In Reserve (0-5). 0 = failure"),
	tempo: z
		.string()
		.optional()
		.describe('Tempo notation e.g. "3-1-2-0" (eccentric-pause-concentric-pause in seconds)'),
	set_type: z
		.enum(["working", "warmup", "dropset", "backoff", "amrap", "cluster"])
		.optional()
		.default("working")
		.describe('Type of this set. Default is "working"'),
});

const exerciseSchema = z.object({
	name: z.string().describe('Exercise name e.g. "Barbell Back Squat", "Dumbbell Bench Press"'),
	sets: z.array(setSchema).describe("Array of sets performed for this exercise"),
	group_id: z
		.number()
		.optional()
		.describe(
			"Group number for supersets/circuits. Exercises with the same group_id are grouped together",
		),
	group_type: z
		.enum(["superset", "circuit", "giant_set"])
		.optional()
		.describe("Type of exercise grouping, if this exercise is part of a group"),
	notes: z
		.string()
		.optional()
		.describe('Exercise-specific notes e.g. "felt tight in left shoulder"'),
});

const workoutLogSchema = z.object({
	activityType: z
		.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"])
		.describe("Activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER"),
	startedAt: z.string().optional().describe("Start date/time in ISO 8601 (defaults to now)"),
	durationMin: z.number().optional().describe("Total workout duration in minutes"),
	distanceKm: z.number().optional().describe("Distance in kilometers (for cardio workouts)"),
	avgHr: z.number().optional().describe("Average heart rate"),
	tss: z.number().optional().describe("Training Stress Score"),
	notes: z.string().optional().describe("General workout notes"),
	exercises: z
		.array(exerciseSchema)
		.optional()
		.describe(
			"Structured exercise data for STRENGTH workouts. Include exercises with their sets, reps, and weights.",
		),
});

// ── Tool factory ──────────────────────────────────────────────

export function createLogWorkoutTool(client: SupabaseClient, userId: string, clubId: string) {
	return tool(
		async (input) => {
			try {
				const startedAt = input.startedAt ?? new Date().toISOString();

				const strengthSession =
					input.activityType === "STRENGTH" && input.exercises && input.exercises.length > 0
						? buildStrengthSessionFromLegacyInput({
								mode: "log_past",
								status: "completed",
								source: "COACH",
								startedAt,
								durationSec: input.durationMin ? input.durationMin * 60 : undefined,
								focus: input.notes,
								sessionNotes: input.notes,
								exercises: input.exercises.map((exercise) => ({
									name: exercise.name,
									notes: exercise.notes,
									groupId: exercise.group_id,
									groupType: exercise.group_type,
									sets: exercise.sets.map((set) => ({
										reps: set.reps,
										weightKg: set.weight_kg,
										rpe: set.rpe,
										rir: set.rir,
										tempo: set.tempo,
										setType: set.set_type,
									})),
								})),
							})
						: undefined;

				const workout = await createCompletedWorkout(client, {
					athleteId: userId,
					clubId,
					activityType: input.activityType,
					startedAt,
					durationSec: input.durationMin ? input.durationMin * 60 : undefined,
					distanceM: input.distanceKm ? input.distanceKm * 1000 : undefined,
					avgHr: input.avgHr,
					tss: input.tss,
					notes: input.notes,
					strengthSession,
					generateEmbedding: true,
				});

				// Build response with exercise summary for STRENGTH workouts
				if (strengthSession?.exercises.length) {
					const exerciseLines = strengthSession.exercises.map((ex) => {
						const workingSets = ex.sets.filter((s) => s.setType !== "warmup");
						const totalVol = workingSets.reduce(
							(sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0),
							0,
						);
						return `  - ${ex.displayName}: ${workingSets.length} working sets, ${totalVol} kg total volume`;
					});
					return `Workout logged successfully (ID: ${workout.id}).\nActivity: ${workout.activity_type}, Date: ${workout.started_at}\n\nExercises logged:\n${exerciseLines.join("\n")}\n\nNow retrieve workout history to compare this session against recent ones.`;
				}

				return `Workout logged successfully (ID: ${workout.id}). Activity: ${workout.activity_type}, Date: ${workout.started_at}`;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error logging workout: ${msg}. Please double check the input and try again.`;
			}
		},
		{
			name: "log_workout",
			description:
				"Logs a new workout for the athlete. For simple completed sessions, use the details already provided and do not block on optional fields like notes or avg HR. For STRENGTH workouts, include structured exercise data (exercises with sets, reps, weight, RPE). Ask follow-up questions only when the workout type or core timing/details are too unclear to log safely.",
			schema: workoutLogSchema,
		},
	);
}
