// ============================================================
// Tool: Analyze Biometric Trends
// Pulls a rolling window of daily logs to provide the LLM
// with trends in HRV, Sleep, RHR, and RPE.
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAverage, lookbackDate } from "@triathlon/core";
import { z } from "zod";
import type { DailyLog } from "../supabase.js";
import { getDailyLogs } from "../supabase.js";

function extractNonNull<T>(items: T[], getter: (item: T) => number | null): number[] {
	return items.map(getter).filter((v): v is number => v != null);
}

function summarizeLogs(logSet: DailyLog[]) {
	return {
		sleep: computeAverage(extractNonNull(logSet, (l) => l.sleep_hours)) ?? "N/A",
		sleepQuality: computeAverage(extractNonNull(logSet, (l) => l.sleep_quality)) ?? "N/A",
		hrv: computeAverage(extractNonNull(logSet, (l) => l.hrv)) ?? "N/A",
		rhr: computeAverage(extractNonNull(logSet, (l) => l.resting_hr)) ?? "N/A",
		rpe: computeAverage(extractNonNull(logSet, (l) => l.rpe)) ?? "N/A",
	};
}

export function createAnalyzeBiometricTrendsTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ days = 30 }) => {
			const logs = await getDailyLogs(client, userId, {
				fromDate: lookbackDate(days),
				limit: days,
			});

			if (logs.length === 0) {
				return `No daily logs found for the last ${days} days. Suggest the athlete log their metrics.`;
			}

			// Split into recent (first half) and previous (second half)
			// Note: logs are ordered log_date desc (newest first)
			const midPoint = Math.floor(logs.length / 2);
			const recentLogs = logs.slice(0, midPoint);
			const olderLogs = logs.slice(midPoint);

			const overall = summarizeLogs(logs);
			const recent = summarizeLogs(recentLogs);
			const older = summarizeLogs(olderLogs);

			let analysis = `**Biometric Trends Analysis (${logs.length} days of data recorded within the last ${days} days)**\n\n`;

			analysis += `### Overall Averages:\n`;
			analysis += `- Sleep: ${overall.sleep} hrs (Quality: ${overall.sleepQuality}/5)\n`;
			analysis += `- HRV: ${overall.hrv} ms\n`;
			analysis += `- Resting HR: ${overall.rhr} bpm\n`;
			analysis += `- Session RPE: ${overall.rpe}/10\n\n`;

			if (recentLogs.length > 0 && olderLogs.length > 0) {
				analysis += `### Trend (Recent ${recentLogs.length} entries vs Previous ${olderLogs.length} entries):\n`;
				analysis += `- Sleep: ${recent.sleep} hrs (vs ${older.sleep} hrs)\n`;
				analysis += `- HRV: ${recent.hrv} ms (vs ${older.hrv} ms)\n`;
				analysis += `- Resting HR: ${recent.rhr} bpm (vs ${older.rhr} bpm)\n`;
				analysis += `- Session RPE: ${recent.rpe}/10 (vs ${older.rpe}/10)\n\n`;
			}

			analysis += `**Coaching Guidance:** Use these trends to give the athlete deep physiological context. Explain the *why* behind their current readiness. If HRV is trending down while RPE is trending up, suggest a deload or more recovery.`;

			return analysis;
		},
		{
			name: "analyze_biometric_trends",
			description:
				"Analyzes the athlete's daily logs over a specific number of days to extract sleep, HRV, Resting HR, and RPE trends. Use this to act as an expert physiologist and identify long-term patterns.",
			schema: z.object({
				days: z
					.number()
					.min(7)
					.max(90)
					.optional()
					.describe("Number of days to look back for the trend analysis (default 30)"),
			}),
		},
	);
}
