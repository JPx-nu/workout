// ============================================================
// Tool: Predict Injury Risk (ACWR Calculator)
// Calculates Acute:Chronic Workload Ratio to predict overtraining
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateSessionLoad, lookbackDate } from "@triathlon/core";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";
import { getWorkouts } from "../supabase.js";

export function createPredictInjuryRiskTool(client: SupabaseClient, userId: string) {
	return tool(
		async () => {
			const workouts = await getWorkouts(client, userId, {
				fromDate: lookbackDate(28),
			});

			if (workouts.length === 0) {
				return "Not enough workout data in the last 28 days to calculate injury risk.";
			}

			// Calculate daily loads using shared estimator
			const dailyLoads: Record<string, number> = {};

			for (const w of workouts) {
				const dateKey = w.started_at.split("T")[0];
				dailyLoads[dateKey] = (dailyLoads[dateKey] || 0) + estimateSessionLoad(w);
			}

			// Calculate Acute Load (last 7 days) and Chronic Load (last 28 days)
			let acuteLoad = 0;
			let chronicLoad = 0;

			const sevenDaysStr = lookbackDate(7);

			for (const [date, load] of Object.entries(dailyLoads)) {
				chronicLoad += load;
				if (date >= sevenDaysStr) {
					acuteLoad += load;
				}
			}

			const avgAcute = acuteLoad / 7;
			const avgChronic = chronicLoad / 28;

			if (avgChronic === 0) {
				return "Chronic training load is zero. Cannot calculate ACWR. Athlete is likely undertrained or returning from a long break.";
			}

			const acwr = avgAcute / avgChronic;

			let riskAssessment = "";
			let recommendations = "";

			const { low, optimal, high } = AI_CONFIG.thresholds.acwr;

			if (acwr < low) {
				riskAssessment = "LOW (Undertraining)";
				recommendations =
					"Athlete is losing fitness. Safe to increase training volume and intensity.";
			} else if (acwr >= low && acwr <= optimal) {
				riskAssessment = "OPTIMAL (Sweet Spot)";
				recommendations =
					"Excellent training progression. Injury risk is minimized. Maintain current progressive overload.";
			} else if (acwr > optimal && acwr <= high) {
				riskAssessment = "CAUTION (Zone of Danger)";
				recommendations =
					"Training load is ramping up quickly. Monitor biometrics closely. Consider a recovery day.";
			} else {
				riskAssessment = "HIGH (Danger Zone)";
				recommendations =
					"Acute load is significantly higher than chronic load. Athlete is at HIGH RISK of injury or illness. Immediately reduce volume or intensity.";
			}

			const report = `**Injury Risk Forecast (ACWR Model)**
            
- **Acute Load (7-day avg):** ${Math.round(avgAcute)} / day
- **Chronic Load (28-day avg):** ${Math.round(avgChronic)} / day
- **Acute:Chronic Workload Ratio (ACWR):** ${acwr.toFixed(2)}

**Risk Assessment:** ${riskAssessment}
**Recommendation:** ${recommendations}

*Coaching Instruction:* Explain this ratio simply to the athlete. If they are in the danger zone, proactively suggest modifying their upcoming workouts to be lighter.`;

			return report;
		},
		{
			name: "predict_injury_risk",
			description:
				"Forecasts the athlete's injury risk by calculating the Acute:Chronic Workload Ratio (ACWR) over the last 28 days. Use this when the athlete asks if they are overtraining, or if you want to verify a training plan is safe.",
			schema: z.object({}), // No required parameters
		},
	);
}
