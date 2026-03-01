import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Tool for evaluating form and technique across tri-sports and strength exercises via uploaded media.
 * This instructs the AI to query the underlying multimodal model for geometric insights.
 */
export const analyzeForm = tool(
	async ({ activityType, specificFocus, userNotes }, _config) => {
		// Note: The actual image data is injected into the LLM context automatically via the chat handler when uploaded.
		// This tool simply triggers the analytical pathway within the agent's logic.

		return JSON.stringify({
			status: "success",
			instruction: `Multimodal analysis triggered for ${activityType}. Focus: ${specificFocus}. User noted: ${userNotes || "None"}. Proceed to evaluate the provided images based on these parameters.`,
			context_directive:
				"System prompt should extract the user's uploaded image URLs from the conversation history and analyze them for posture, joint angles, pacing, and overall technique.",
		});
	},
	{
		name: "analyze_form",
		description:
			"Triggers an in-depth biomechanical analysis of user-uploaded images/videos to critique their workout form. ONLY call this when the user explicitly provides visual media and asks for form feedback.",
		schema: z.object({
			activityType: z
				.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA"])
				.describe("The sport or exercise type being performed."),
			specificFocus: z
				.string()
				.describe(
					"What the user specifically wants critiqued (e.g., 'catch phase in swim', 'squat depth', 'running cadence').",
				),
			userNotes: z
				.string()
				.optional()
				.describe(
					"Any context the user provided about their injury history or current feelings during this workout.",
				),
		}),
	},
);
