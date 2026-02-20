import { tool } from "@langchain/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export function createPassBatonTool(client: SupabaseClient, userId: string) {
	return tool(
		async ({ toAthleteId, distanceMeters, notes }: Record<string, any>) => {
			// 1. Find user's squads
			const { data: squadMemberships, error: squadErr } = await client
				.from("squad_members")
				.select("squad_id")
				.eq("athlete_id", userId);

			if (squadErr || !squadMemberships || squadMemberships.length === 0) {
				return "User is not currently in any squads.";
			}

			const squadIds = squadMemberships.map((m) => m.squad_id);

			// 2. Find an active relay event for these squads
			const { data: activeRelays, error: relayErr } = await client
				.from("relay_events")
				.select("*")
				.in("squad_id", squadIds)
				.eq("status", "active")
				.limit(1);

			if (relayErr || !activeRelays || activeRelays.length === 0) {
				return "No active relay events found for the user's squads.";
			}

			const relay = activeRelays[0];

			// 3. Insert baton pass
			const { error: insertErr } = await client.from("baton_passes").insert({
				relay_id: relay.id,
				from_athlete_id: userId,
				to_athlete_id: toAthleteId,
				distance_m: distanceMeters,
				passed_at: new Date().toISOString(),
			});

			if (insertErr) {
				return `Failed to pass the baton: ${insertErr.message}`;
			}

			// 4. Update relay distance
			// Normally we'd use an RPC for atomic increment, but for MVP we can just calculate it in JS
			const newTotal = (relay.total_distance_m || 0) + distanceMeters;
			const isCompleted = newTotal >= relay.goal_distance_m;

			const updatePayload: any = {
				total_distance_m: newTotal,
			};

			if (isCompleted) {
				updatePayload.status = "completed";
				updatePayload.ended_at = new Date().toISOString();
			}

			const { error: updateErr } = await client
				.from("relay_events")
				.update(updatePayload)
				.eq("id", relay.id);

			if (updateErr) {
				return `Baton passed, but failed to update relay total distance: ${updateErr.message}`;
			}

			return JSON.stringify({
				success: true,
				message: `Successfully passed the baton to athlete ${toAthleteId} for ${distanceMeters}m!`,
				relayEvent: {
					id: relay.id,
					totalDistanceM: newTotal,
					goalDistanceM: relay.goal_distance_m,
					status: isCompleted ? "completed" : "active",
				},
				notes: notes || null,
			});
		},
		{
			name: "pass_baton",
			description:
				"Pass the baton in an active squad relay event. This creates a baton pass record to another squad member and adds distance to the relay total.",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			schema: z.object({
				toAthleteId: z
					.string()
					.describe(
						"The ID of the squad member to pass the baton to. You can get this ID from the get_squad_leaderboard tool.",
					),
				distanceMeters: z
					.number()
					.describe(
						"The distance in meters contributed to the relay leg by this pass.",
					),
				notes: z
					.string()
					.optional()
					.describe("Optional message or cheer to send to the next athlete."),
			}) as any,
		},
	);
}
