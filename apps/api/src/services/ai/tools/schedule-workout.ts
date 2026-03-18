/**
 * schedule-workout — AI tool for scheduling a single workout session.
 *
 * Handles quick requests like "add a run tomorrow" or
 * "schedule a 45-min strength session on Friday".
 */

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";
import { createLogger } from "../../../lib/logger.js";
import { buildStrengthSessionFromLegacyInput, createPlannedWorkout } from "../../workout-center.js";

const log = createLogger({ module: "tool-schedule-workout" });

const scheduleSetSchema = z.object({
	reps: z.number().optional(),
	weight_kg: z.number().optional(),
	rpe: z.number().min(1).max(10).optional(),
	rir: z.number().min(0).max(5).optional(),
	tempo: z.string().optional(),
	set_type: z
		.enum(["working", "warmup", "dropset", "backoff", "amrap", "cluster"])
		.optional()
		.default("working"),
});

const scheduleExerciseSchema = z.object({
	name: z.string().min(1),
	notes: z.string().optional(),
	group_id: z.number().optional(),
	group_type: z.enum(["superset", "circuit", "giant_set"]).optional(),
	sets: z.array(scheduleSetSchema).optional().default([]),
});

const scheduleWorkoutSchema = z.object({
	plannedDate: z.string().describe("ISO date (YYYY-MM-DD) for the workout"),
	plannedTime: z.string().optional().describe("Optional start time (HH:MM)"),
	activityType: z
		.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"])
		.describe("Type of workout"),
	title: z.string().describe('Short title, e.g. "Easy Zone 2 Run"'),
	description: z.string().optional().describe("Detailed session instructions"),
	durationMin: z.number().int().min(5).optional().describe("Duration in minutes"),
	distanceKm: z.number().optional().describe("Target distance in km"),
	intensity: z
		.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"])
		.optional()
		.describe("Target intensity level"),
	targetRpe: z.number().int().min(1).max(10).optional().describe("Target RPE (1-10)"),
	notes: z.string().optional().describe("Any additional notes"),
	exercises: z
		.array(scheduleExerciseSchema)
		.optional()
		.describe("Optional structured strength session details for STRENGTH workouts"),
});

export function createScheduleWorkoutTool(client: SupabaseClient, userId: string, clubId: string) {
	return tool(
		async (input) => {
			try {
				const { data: activePlan } = await client
					.from("training_plans")
					.select("id")
					.eq("athlete_id", userId)
					.eq("status", "active")
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle();

				log.debug({ activePlanId: activePlan?.id ?? null, userId, clubId }, "Scheduling workout");

				const strengthSession =
					input.activityType === "STRENGTH" && input.exercises && input.exercises.length > 0
						? buildStrengthSessionFromLegacyInput({
								mode: "schedule",
								status: "planned",
								source: "AI",
								plannedDate: input.plannedDate,
								plannedTime: input.plannedTime,
								durationSec: input.durationMin ? input.durationMin * 60 : undefined,
								focus: input.title,
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

				await createPlannedWorkout(client, {
					athleteId: userId,
					clubId,
					planId: activePlan?.id ?? undefined,
					plannedDate: input.plannedDate,
					plannedTime: input.plannedTime,
					activityType: input.activityType,
					title: input.title,
					description: input.description,
					durationMin: input.durationMin,
					distanceKm: input.distanceKm,
					intensity: input.intensity,
					targetRpe: input.targetRpe,
					notes: input.notes,
					status: "planned",
					source: "AI",
					sessionData: strengthSession,
				});

				const emoji = AI_CONFIG.activityEmoji[input.activityType] ?? "⚡";

				return `${emoji} Scheduled "${input.title}" on ${input.plannedDate}${input.plannedTime ? ` at ${input.plannedTime}` : ""}${input.durationMin ? ` (${input.durationMin} min)` : ""}${input.intensity ? ` — ${input.intensity}` : ""}. Check your training calendar!`;
			} catch (error) {
				log.error({ err: error }, "Failed to schedule workout");
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `❌ Failed to schedule workout: ${msg}`;
			}
		},
		{
			name: "schedule_workout",
			description:
				'Schedules a single workout session on a specific date. Use for quick requests like "add a run tomorrow" or "schedule strength on Friday". For full multi-week plans, use generate_workout_plan instead.',
			schema: scheduleWorkoutSchema,
		},
	);
}
