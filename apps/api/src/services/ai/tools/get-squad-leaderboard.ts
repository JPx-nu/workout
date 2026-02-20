import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export function createGetSquadLeaderboardTool(
	client: SupabaseClient,
	userId: string,
) {
	return tool(
		async ({ timeframeDays }: Record<string, string | number | undefined>) => {
			const days = (timeframeDays as number) || 7;
			const threshold = new Date(
				Date.now() - days * 24 * 60 * 60 * 1000,
			).toISOString();

			// 1. Get the squads the user is a member of
			const { data: squadMemberships, error: squadErr } = await client
				.from("squad_members")
				.select("squad_id, squads(name)")
				.eq("athlete_id", userId);

			if (squadErr || !squadMemberships || squadMemberships.length === 0) {
				return "User is not currently in any squads.";
			}

			const squadIds = squadMemberships.map((m) => m.squad_id);

			// 2. Get all members of those squads
			const { data: allMembers, error: memErr } = await client
				.from("squad_members")
				.select("squad_id, athlete_id, squads(name), profiles(display_name)")
				.in("squad_id", squadIds);

			if (memErr || !allMembers) {
				return "Could not retrieve squad members.";
			}

			const athleteIds = [...new Set(allMembers.map((m) => m.athlete_id))];

			// 3. Get recent workouts for those members
			const { data: workouts, error: workErr } = await client
				.from("workouts")
				.select("athlete_id, duration_s")
				.in("athlete_id", athleteIds)
				.gte("started_at", threshold);

			if (workErr || !workouts) {
				return "Could not retrieve recent workouts for leaderboard.";
			}

			// Aggregate by athlete
			const leaderboard = athleteIds
				.map((aId) => {
					const athleteWorkouts = workouts.filter((w) => w.athlete_id === aId);
					const totalDurationS = athleteWorkouts.reduce(
						(sum, w) => sum + (w.duration_s || 0),
						0,
					);
					const profile = allMembers.find(
						(m) => m.athlete_id === aId,
					)?.profiles;
					const displayName =
						profile && typeof profile === "object" && "display_name" in profile
							? profile.display_name
							: "Unknown Athlete";

					return {
						athleteId: aId,
						displayName,
						totalWorkouts: athleteWorkouts.length,
						totalDurationMinutes: Math.round(totalDurationS / 60),
					};
				})
				.sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes);

			const result = {
				timeframe: `Past ${days} days`,
				squads: [
					...new Set(
						squadMemberships.map((m) => {
							const squad = m.squads;
							return squad && typeof squad === "object" && "name" in squad
								? squad.name
								: "Unknown Squad";
						}),
					),
				],
				leaderboard: leaderboard.map((l, index) => ({
					rank: index + 1,
					athlete:
						l.athleteId === userId ? `${l.displayName} (You)` : l.displayName,
					workouts: l.totalWorkouts,
					minutes: l.totalDurationMinutes,
				})),
			};

			return JSON.stringify(result, null, 2);
		},
		{
			name: "get_squad_leaderboard",
			description:
				"Gets the workout leaderboard for the athlete's squads, ranking members by accumulated workout minutes over the specified timeframe.",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			schema: z.object({
				timeframeDays: z
					.number()
					.optional()
					.describe("Number of days to look back"),
			}) as any,
		},
	);
}
