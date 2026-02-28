// ============================================================
// Tool: Get Training Plan
// Fetches the active training plan and upcoming events
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getTrainingPlan, getUpcomingEvents } from "../supabase.js";

export function createGetTrainingPlanTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async () => {
			try {
				const [plan, events] = await Promise.all([
					getTrainingPlan(client, userId),
					getUpcomingEvents(client, userId, 5),
				]);

				return JSON.stringify({
					plan: plan
						? {
							id: plan.id,
							name: plan.name,
							status: plan.status,
							planData: plan.plan_data,
						}
						: null,
					upcomingEvents: events.map((e) => ({
						id: e.id,
						name: e.name,
						date: e.event_date,
						distanceType: e.distance_type,
					})),
				});
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error fetching training plan: ${msg}. Please try again.`;
			}
		},
		{
			name: "get_training_plan",
			description:
				"Fetches the active training plan and upcoming events. Use when asked about scheduled workouts, race calendar, or training blocks.",
			schema: z.object({}),
		},
	);
}
