// ============================================================
// Tool: Get Progress Report
// Computes summary statistics and trends from workout + health data
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAverage, lookbackDate } from "@triathlon/core";
import { z } from "zod";
import { getDailyLogs, getWorkouts } from "../supabase.js";

export function createGetProgressReportTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ days }) => {
			const lookbackDays = days ?? 14;
			const fromDate = lookbackDate(lookbackDays);

			const [workouts, dailyLogs] = await Promise.all([
				getWorkouts(client, userId, { fromDate, limit: 200 }),
				getDailyLogs(client, userId, { fromDate, limit: 200 }),
			]);

			// ── Workout summary ────────────────────────────────
			const byActivity: Record<string, { count: number; totalMin: number; totalKm: number }> = {};
			for (const w of workouts) {
				const key = w.activity_type;
				if (!byActivity[key]) byActivity[key] = { count: 0, totalMin: 0, totalKm: 0 };
				byActivity[key].count++;
				byActivity[key].totalMin += w.duration_s ? Math.round(w.duration_s / 60) : 0;
				byActivity[key].totalKm += w.distance_m ? +(w.distance_m / 1000).toFixed(2) : 0;
			}

			// ── Health trends ──────────────────────────────────
			const nonNull = <T>(items: T[], fn: (i: T) => number | null) =>
				items.map(fn).filter((v): v is number => v != null);

			return JSON.stringify({
				period: `Last ${lookbackDays} days`,
				totalWorkouts: workouts.length,
				byActivity,
				healthTrends: {
					avgSleepHours: computeAverage(nonNull(dailyLogs, (d) => d.sleep_hours)),
					avgHrv: computeAverage(nonNull(dailyLogs, (d) => d.hrv)),
					avgMood: computeAverage(nonNull(dailyLogs, (d) => d.mood)),
					avgRpe: computeAverage(nonNull(dailyLogs, (d) => d.rpe)),
					daysLogged: dailyLogs.length,
				},
			});
		},
		{
			name: "get_progress_report",
			description:
				'Generates a progress report with workout summaries and health trends. Use for weekly reviews, trend analysis, or when the athlete asks "how am I doing?"',
			schema: z.object({
				days: z.number().optional().describe("Number of days to analyze (default 14)"),
			}),
		},
	);
}
