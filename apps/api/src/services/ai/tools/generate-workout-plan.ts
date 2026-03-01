/**
 * generate-workout-plan — AI tool that creates a structured multi-week training plan.
 *
 * Uses LangChain withStructuredOutput + Zod to produce a typed plan,
 * then inserts rows into training_plans + planned_workouts.
 */

import { tool } from "@langchain/core/tools";
import { AzureChatOpenAI } from "@langchain/openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toIsoDate } from "@triathlon/core";
import { z } from "zod";
import { AI_CONFIG } from "../../../config/ai.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger({ module: "tool-generate-workout-plan" });

// ── Input schema ───────────────────────────────────────────────

const generatePlanInputSchema = z.object({
	goal: z.string().describe('Primary goal, e.g. "finish a half marathon in under 2 hours"'),
	durationWeeks: z.number().int().min(1).max(52).default(8).describe("Plan duration in weeks"),
	weeklyAvailability: z
		.number()
		.int()
		.min(1)
		.max(14)
		.default(5)
		.describe("Number of training sessions per week"),
	focusActivities: z
		.array(z.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]))
		.default(["RUN", "STRENGTH"])
		.describe("Activities to include in the plan"),
	eventDate: z
		.string()
		.optional()
		.describe("Target event date (ISO 8601) if training for a specific event"),
	additionalContext: z
		.string()
		.optional()
		.describe("Any extra context: injuries, preferences, equipment available"),
});

// ── Output schema (for withStructuredOutput) ───────────────────

const sessionOutputSchema = z.object({
	dayOffset: z.number().int().min(0).describe("Day offset from week start (0=Monday)"),
	activityType: z.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]),
	title: z.string().describe("Concise session title"),
	description: z.string().describe("Detailed instructions for the athlete"),
	durationMin: z.number().int().min(5),
	intensity: z.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"]),
	targetRpe: z.number().int().min(1).max(10).optional(),
	distanceKm: z.number().optional(),
});

const weekOutputSchema = z.object({
	weekNumber: z.number().int().min(1),
	theme: z.string().describe("Week theme/focus"),
	sessions: z.array(sessionOutputSchema).min(1),
});

const planOutputSchema = z.object({
	name: z.string().describe("Plan name"),
	goal: z.string(),
	weeks: z.array(weekOutputSchema).min(1),
});

// ── Tool factory ───────────────────────────────────────────────

export function createGenerateWorkoutPlanTool(
	client: SupabaseClient,
	userId: string,
	clubId: string,
) {
	return tool(
		async (input) => {
			try {
				// 1. Gather context about the athlete
				const [profileRes, historyRes, logRes, injuryRes] = await Promise.all([
					client.from("profiles").select("*").eq("id", userId).single(),
					client
						.from("workouts")
						.select("activity_type, duration_s, distance_m, tss, started_at")
						.eq("athlete_id", userId)
						.order("started_at", { ascending: false })
						.limit(20),
					client
						.from("daily_logs")
						.select("*")
						.eq("athlete_id", userId)
						.order("log_date", { ascending: false })
						.limit(7),
					client
						.from("injuries")
						.select("body_part, severity, notes")
						.eq("athlete_id", userId)
						.is("resolved_at", null),
				]);

				const context = {
					profile: profileRes.data,
					recentWorkouts: historyRes.data || [],
					recentLogs: logRes.data || [],
					activeInjuries: injuryRes.data || [],
				};

				// 2. Generate structured plan using withStructuredOutput
				const llm = new AzureChatOpenAI({
					azureOpenAIEndpoint: AI_CONFIG.azure.endpoint,
					azureOpenAIApiKey: AI_CONFIG.azure.apiKey,
					azureOpenAIApiDeploymentName: AI_CONFIG.azure.deploymentName,
					azureOpenAIApiVersion: AI_CONFIG.azure.apiVersion,
					temperature: 0.7,
				});

				const structuredLlm = llm.withStructuredOutput(planOutputSchema, {
					name: "training_plan",
				});

				const systemMessage = `You are an expert sports coach and exercise scientist. Generate a structured training plan based on:

ATHLETE CONTEXT:
${JSON.stringify(context, null, 2)}

PLAN REQUIREMENTS:
- Goal: ${input.goal}
- Duration: ${input.durationWeeks} weeks
- Sessions/week: ${input.weeklyAvailability}
- Activities: ${input.focusActivities.join(", ")}
${input.eventDate ? `- Event date: ${input.eventDate}` : ""}
${input.additionalContext ? `- Notes: ${input.additionalContext}` : ""}
${context.activeInjuries.length > 0 ? `\n⚠️ ACTIVE INJURIES: ${JSON.stringify(context.activeInjuries)} — adjust plan to avoid aggravating these.` : ""}

GUIDELINES:
- Follow periodization principles (base → build → peak → taper if racing)
- Include recovery days and deload weeks
- Progress gradually (max 10% weekly volume increase)
- Vary intensity across the week (hard/easy pattern)
- For STRENGTH sessions, focus on compound movements
- Set realistic RPE targets for each session
- Day offsets: 0=Monday through 6=Sunday`;

				const plan = await structuredLlm.invoke(systemMessage);

				// 3. Calculate start date
				const startDate = new Date();
				// Start on the coming Monday
				const dayOfWeek = startDate.getDay();
				const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
				startDate.setDate(startDate.getDate() + daysUntilMonday);

				// 4. Create training_plans row
				const { data: planRow, error: planError } = await client
					.from("training_plans")
					.insert({
						athlete_id: userId,
						club_id: clubId,
						name: plan.name,
						status: "active",
						plan_data: {
							goal: plan.goal,
							durationWeeks: input.durationWeeks,
							weeklyAvailability: input.weeklyAvailability,
							focusActivities: input.focusActivities,
							eventDate: input.eventDate || null,
							generatedAt: new Date().toISOString(),
						},
					})
					.select("id")
					.single();

				if (planError) throw new Error(`Failed to create plan: ${planError.message}`);

				// 5. Insert all planned_workouts
				const plannedWorkouts = plan.weeks.flatMap((week) =>
					week.sessions.map((session) => {
						const sessionDate = new Date(startDate);
						sessionDate.setDate(
							sessionDate.getDate() + (week.weekNumber - 1) * 7 + session.dayOffset,
						);

						return {
							athlete_id: userId,
							club_id: clubId,
							plan_id: planRow.id,
							planned_date: toIsoDate(sessionDate),
							activity_type: session.activityType,
							title: session.title,
							description: session.description,
							duration_min: session.durationMin,
							distance_km: session.distanceKm || null,
							target_rpe: session.targetRpe || null,
							intensity: session.intensity,
							status: "planned",
							source: "AI",
							coach_notes: `Week ${week.weekNumber}: ${week.theme}`,
						};
					}),
				);

				const { error: insertError } = await client
					.from("planned_workouts")
					.insert(plannedWorkouts);

				if (insertError) throw new Error(`Failed to insert workouts: ${insertError.message}`);

				// 6. Build summary
				const totalSessions = plannedWorkouts.length;
				const weekSummaries = plan.weeks.map(
					(w) => `  Week ${w.weekNumber} (${w.theme}): ${w.sessions.length} sessions`,
				);

				return `✅ Created "${plan.name}" — ${input.durationWeeks}-week plan with ${totalSessions} sessions.

Goal: ${plan.goal}
Starts: ${toIsoDate(startDate)} (coming Monday)

${weekSummaries.join("\n")}

The plan is now visible in your training calendar. You can ask me to adjust any session or week.`;
			} catch (error) {
				const msg = error instanceof Error ? error.message : "Unknown error";
				log.error({ err: msg }, "Failed to generate workout plan");
				return `❌ Failed to generate plan: ${msg}`;
			}
		},
		{
			name: "generate_workout_plan",
			description: `Generates a structured multi-week training plan personalized to the athlete's goals, fitness level, and readiness. Creates the plan and all scheduled sessions. Use when the athlete asks for a training plan, wants to prepare for an event, or needs a structured program.`,
			schema: generatePlanInputSchema,
		},
	);
}
