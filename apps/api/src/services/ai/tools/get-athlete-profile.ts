// ============================================================
// Tool: Get Athlete Profile
// Fetches the athlete's profile and active injuries
// ============================================================

import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getInjuries, getProfile } from "../supabase.js";

export function createGetAthleteProfileTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async () => {
			const [profile, injuries] = await Promise.all([
				getProfile(client, userId),
				getInjuries(client, userId, true),
			]);

			if (!profile)
				return "No athlete profile found. The user may need to complete onboarding.";

			return JSON.stringify({
				name: profile.display_name,
				timezone: profile.timezone,
				role: profile.role,
				preferences: profile.preferences,
				activeInjuries: injuries.map((i) => ({
					bodyPart: i.body_part,
					severity: i.severity,
					since: i.reported_at,
					notes: i.notes,
				})),
			});
		},
		{
			name: "get_athlete_profile",
			description:
				"Fetches the athlete profile including preferences and active injuries. Use at the start of a conversation or when asked about the athlete.",
			schema: z.object({}) as any,
		},
	);
}
