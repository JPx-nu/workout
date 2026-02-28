// ============================================================
// Tool: Get Workout History
// Fetches recent workouts with optional filters.
// For STRENGTH workouts, parses raw_data into a compact
// exercise summary with e1RM, volume, and top sets.
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getWorkouts } from "../supabase.js";
import {
	computeAverageRPE,
	computeSessionVolume,
	type ExerciseData,
	summarizeStrengthWorkout,
} from "../utils/strength-utils.js";

export function createGetWorkoutHistoryTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async ({ activityType, fromDate, toDate, limit }) => {
			try {
				const workouts = await getWorkouts(client, userId, {
					activityType,
					fromDate,
					toDate,
					limit: limit ?? 10,
				});

				if (!workouts.length) return "No workouts found for the given filters.";

				return JSON.stringify(
					workouts.map((w) => {
						const base = {
							date: w.started_at,
							activityType: w.activity_type,
							durationMin: w.duration_s ? Math.round(w.duration_s / 60) : null,
							notes: w.notes,
						};

						// For STRENGTH workouts: parse raw_data into exercise summaries
						if (w.activity_type === "STRENGTH" && w.raw_data) {
							const exerciseSummaries = summarizeStrengthWorkout(w.raw_data);
							const rawExercises = (w.raw_data as Record<string, unknown>)
								?.exercises as ExerciseData[] | undefined;

							return {
								...base,
								exercises: exerciseSummaries,
								sessionVolume_kg: rawExercises
									? computeSessionVolume(rawExercises)
									: null,
								avgRPE: rawExercises ? computeAverageRPE(rawExercises) : null,
							};
						}

						// For cardio/other workouts: return standard metrics
						return {
							...base,
							distanceKm: w.distance_m ? +(w.distance_m / 1000).toFixed(2) : null,
							avgHr: w.avg_hr,
							maxHr: w.max_hr,
							avgPower: w.avg_power_w,
							tss: w.tss,
						};
					}),
				);
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error fetching workout history: ${msg}. Please check parameters and try again.`;
			}
		},
		{
			name: "get_workout_history",
			description:
				"Retrieves recent workouts for the athlete. For STRENGTH workouts returns exercise details including top sets, volume, and estimated 1RM. Use to compare sessions and track progressive overload.",
			schema: z.object({
				activityType: z
					.string()
					.optional()
					.describe(
						"Filter by activity type: SWIM, BIKE, RUN, STRENGTH, YOGA, OTHER",
					),
				fromDate: z
					.string()
					.optional()
					.describe("Start date filter (YYYY-MM-DD)"),
				toDate: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
				limit: z
					.number()
					.optional()
					.describe("Max workouts to return (default 10, max 50)"),
			}),
		},
	);
}
