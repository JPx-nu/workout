// ============================================================
// Tool: Analyze Workouts
// Computes deep training insights over a date range: load,
// volume, intensity distribution.
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateSessionLoad, lookbackDate } from "@triathlon/core";
import { z } from "zod";
import { getWorkouts } from "../supabase.js";

export function createAnalyzeWorkoutsTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ days = 30 }) => {
			const workouts = await getWorkouts(client, userId, {
				fromDate: lookbackDate(days),
			});

			if (workouts.length === 0) {
				return `No workouts found for the last ${days} days.`;
			}

			let totalVolumeS = 0;
			let totalTss = 0;
			const activityCounts: Record<string, number> = {};

			for (const w of workouts) {
				if (w.duration_s != null) totalVolumeS += w.duration_s;
				totalTss += estimateSessionLoad(w);
				activityCounts[w.activity_type] = (activityCounts[w.activity_type] || 0) + 1;
			}

			const totalHours = (totalVolumeS / 3600).toFixed(1);
			const weeklyAvgHours = (totalVolumeS / 3600 / (days / 7)).toFixed(1);
			const totalLoad = Math.round(totalTss);
			const weeklyAvgLoad = Math.round(totalTss / (days / 7));

			const breakdown = Object.entries(activityCounts)
				.map(([type, count]) => `- ${type}: ${count} sessions`)
				.join("\n");

			let analysis = `**Workout Analysis (${days} days)**\n\n`;
			analysis += `### Volume & Load\n`;
			analysis += `- Total Hours: ${totalHours}h (Avg ${weeklyAvgHours}h / week)\n`;
			analysis += `- Total Estimated Load (TSS/TRIMP): ${totalLoad} (Avg ${weeklyAvgLoad} / week)\n\n`;

			analysis += `### Activity Breakdown\n`;
			analysis += `${breakdown}\n\n`;

			analysis += `**Coaching Guidance:** Use this to evaluate whether the athlete's training volume is appropriate. If they are feeling fatigued (check biometrics), tell them their weekly load is ${weeklyAvgLoad} which might be too high for their current recovery state. If they want to build fitness, ensure progressive overload.`;

			return analysis;
		},
		{
			name: "analyze_workouts",
			description:
				"Analyzes the athlete's completed workouts over a specific number of days to extract volume, load (TSS/TRIMP), and activity distribution. Use this to act as a Sports Scientist.",
			schema: z.object({
				days: z
					.number()
					.min(7)
					.max(90)
					.optional()
					.describe("Number of days to look back (default 30)"),
			}),
		},
	);
}
