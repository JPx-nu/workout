// ============================================================
// Tool: Analyze Biometric Trends
// Pulls a rolling window of daily logs to provide the LLM
// with trends in HRV, Sleep, RHR, and RPE.
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toIsoDate } from "@triathlon/core";
import { z } from "zod";
import { getDailyLogs } from "../supabase.js";

export function createAnalyzeBiometricTrendsTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ days = 30 }) => {
			const toDate = new Date();
			const fromDate = new Date();
			fromDate.setDate(toDate.getDate() - days);

			const logs = await getDailyLogs(client, userId, {
				fromDate: toIsoDate(fromDate),
				toDate: toIsoDate(toDate),
				limit: days, // limit to max requested days just in case
			});

			if (logs.length === 0) {
				return `No daily logs found for the last ${days} days. Suggest the athlete log their metrics.`;
			}

			// Split into recent (first half of period) and previous (second half)
			// Note: logs are ordered log_date desc (newest first)
			const midPoint = Math.floor(logs.length / 2);
			const recentLogs = logs.slice(0, midPoint);
			const olderLogs = logs.slice(midPoint);

			const calculateAvgs = (logSet: typeof logs) => {
				let s = 0,
					sc = 0;
				let sq = 0,
					sqc = 0;
				let h = 0,
					hc = 0;
				let rh = 0,
					rhc = 0;
				let rp = 0,
					rpc = 0;

				logSet.forEach((l) => {
					if (l.sleep_hours != null) {
						s += l.sleep_hours;
						sc++;
					}
					if (l.sleep_quality != null) {
						sq += l.sleep_quality;
						sqc++;
					}
					if (l.hrv != null) {
						h += l.hrv;
						hc++;
					}
					if (l.resting_hr != null) {
						rh += l.resting_hr;
						rhc++;
					}
					if (l.rpe != null) {
						rp += l.rpe;
						rpc++;
					}
				});

				return {
					sleep: sc > 0 ? (s / sc).toFixed(1) : "N/A",
					sleepQuality: sqc > 0 ? (sq / sqc).toFixed(1) : "N/A",
					hrv: hc > 0 ? Math.round(h / hc) : "N/A",
					rhr: rhc > 0 ? Math.round(rh / rhc) : "N/A",
					rpe: rpc > 0 ? (rp / rpc).toFixed(1) : "N/A",
				};
			};

			const overall = calculateAvgs(logs);
			const recent = calculateAvgs(recentLogs);
			const older = calculateAvgs(olderLogs);

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
