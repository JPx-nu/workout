// ============================================================
// Tool: Modify Training Plan
// Updates an existing training plan's data or status
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getTrainingPlan, updateTrainingPlan } from "../supabase.js";

export function createModifyTrainingPlanTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async (input: Record<string, unknown>) => {
			const planData = input.planData as Record<string, unknown> | undefined;
			const status = input.status as string | undefined;

			const currentPlan = await getTrainingPlan(client, userId);
			if (!currentPlan) return "No active training plan found. Cannot modify.";

			const updates: Record<string, unknown> = {};
			if (planData !== undefined) updates.plan_data = planData;
			if (status !== undefined) updates.status = status;

			if (Object.keys(updates).length === 0) return "No changes specified.";

			const updated = await updateTrainingPlan(client, currentPlan.id, updates);
			return `Training plan "${updated.name}" updated successfully. Status: ${updated.status}`;
		},
		{
			name: "modify_training_plan",
			description:
				"Modifies the active training plan. Can update plan data (sessions, schedule) or status. Always confirm changes with the athlete first.",
			schema: z.object({
				planData: z
					.record(z.string(), z.unknown())
					.optional()
					.describe("Updated plan data object (sessions, schedule, notes)"),
				status: z
					.string()
					.optional()
					.describe("New plan status: ACTIVE, PAUSED, COMPLETED, CANCELLED"),
			}) as any,
		},
	);
}
