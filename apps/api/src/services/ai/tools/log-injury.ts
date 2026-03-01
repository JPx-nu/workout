import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toIsoDate } from "@triathlon/core";
import { z } from "zod";
import { insertInjury } from "../supabase.js";

export function createLogInjuryTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ bodyPart, severity, date, notes }) => {
			try {
				const reportedAt = date ?? toIsoDate();

				const injury = await insertInjury(client, {
					athlete_id: userId,
					body_part: bodyPart,
					severity,
					reported_at: reportedAt,
					notes,
				});

				return `Injury logged successfully for ${injury.body_part} with severity ${injury.severity}/100. Let the athlete know you've noted it down and remind them to take it easy if the severity is high.`;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				return `Error logging injury: ${msg}. Please try again.`;
			}
		},
		{
			name: "log_injury",
			description:
				"Logs a new physical issue, pain, or injury for the athlete. Severity is 1-100 (100 being extreme pain/unable to train). Use when the athlete mentions soreness or pain in a specific body part.",
			schema: z.object({
				bodyPart: z
					.string()
					.describe(
						"The specific muscle or joint affected (e.g., 'Left Knee', 'Lower Back', 'Hamstrings')",
					),
				severity: z.number().min(1).max(100).describe("Severity score from 1-100"),
				date: z.string().optional().describe("Date reported (YYYY-MM-DD), defaults to today"),
				notes: z.string().optional().describe("Additional context about the injury or pain"),
			}),
		},
	);
}
