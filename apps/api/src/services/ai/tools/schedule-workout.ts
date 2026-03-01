/**
 * schedule-workout — AI tool for scheduling a single workout session.
 *
 * Handles quick requests like "add a run tomorrow" or
 * "schedule a 45-min strength session on Friday".
 */

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger({ module: "tool-schedule-workout" });

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
});

export function createScheduleWorkoutTool(client: SupabaseClient, userId: string, clubId: string) {
	return tool(
		async (input) => {
			try {
				// Optionally link to active training plan
				const { data: activePlan } = await client
					.from("training_plans")
					.select("id")
					.eq("athlete_id", userId)
					.eq("status", "active")
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle();

				log.debug({ activePlanId: activePlan?.id ?? null, userId, clubId }, "Scheduling workout");

				const { data, error } = await client
					.from("planned_workouts")
					.insert({
						athlete_id: userId,
						club_id: clubId,
						plan_id: activePlan?.id || null,
						planned_date: input.plannedDate,
						planned_time: input.plannedTime || null,
						activity_type: input.activityType,
						title: input.title,
						description: input.description || null,
						duration_min: input.durationMin || null,
						distance_km: input.distanceKm || null,
						intensity: input.intensity || null,
						target_rpe: input.targetRpe || null,
						notes: input.notes || null,
						status: "planned",
						source: "AI",
					})
					.select()
					.single();

				log.debug({ workoutId: data?.id, error }, "Insert result");
				if (error) throw new Error(error.message);

				const emoji = {
					SWIM: "🏊",
					BIKE: "🚴",
					RUN: "🏃",
					STRENGTH: "🏋️",
					YOGA: "🧘",
					OTHER: "⚡",
				}[input.activityType];

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
