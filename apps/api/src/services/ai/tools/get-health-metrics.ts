// ============================================================
// Tool: Get Health Metrics
// Fetches daily logs and health metrics for wellness analysis
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getDailyLogs, getHealthMetrics } from "../supabase.js";

export function createGetHealthMetricsTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async ({
			days,
			metricType,
		}: Record<string, string | number | undefined>) => {
			const lookbackDays = (days as number | undefined) ?? 7;
			const fromDate = new Date(Date.now() - lookbackDays * 86400000)
				.toISOString()
				.split("T")[0];

			const [dailyLogs, healthMetrics] = await Promise.all([
				getDailyLogs(client, userId, { fromDate, limit: lookbackDays }),
				getHealthMetrics(client, userId, {
					fromDate,
					metricType: metricType as string | undefined,
				}),
			]);

			return JSON.stringify({
				dailyLogs: dailyLogs.map((d) => ({
					date: d.log_date,
					sleepHours: d.sleep_hours,
					sleepQuality: d.sleep_quality,
					rpe: d.rpe,
					mood: d.mood,
					hrv: d.hrv,
					restingHr: d.resting_hr,
					weightKg: d.weight_kg,
					notes: d.notes,
				})),
				healthMetrics: healthMetrics.map((m) => ({
					type: m.metric_type,
					value: m.value,
					unit: m.unit,
					recordedAt: m.recorded_at,
					source: m.source,
				})),
			});
		},
		{
			name: "get_health_metrics",
			description:
				"Fetches daily wellness logs (sleep, HRV, mood, RPE) and health metrics. Use to assess recovery, readiness, and trends.",
			schema: z.object({
				days: z
					.number()
					.optional()
					.describe("Number of days to look back (default 7)"),
				metricType: z
					.string()
					.optional()
					.describe("Filter health metrics by type (e.g., VO2_MAX, BODY_FAT)"),
			}) as any,
		},
	);
}
