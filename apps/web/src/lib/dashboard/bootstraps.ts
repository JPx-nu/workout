import "server-only";

import {
	type MappedPlannedWorkout,
	type MappedWorkout,
	mapPlannedWorkoutRow,
	mapWorkoutRow,
	type PlannedWorkoutRow,
	type WorkoutRow,
} from "@triathlon/core";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CoachPageBootstrap, WorkoutCenterBootstrap, WorkoutsPageBootstrap } from "./types";

function getWideRange(): { from: string; to: string } {
	const now = new Date();
	const from = new Date(now);
	from.setDate(from.getDate() - 365);

	const to = new Date(now);
	to.setDate(to.getDate() + 365);

	return {
		from: from.toISOString().split("T")[0] ?? "",
		to: to.toISOString().split("T")[0] ?? "",
	};
}

const loadWorkoutRows = cache(async (userId: string): Promise<MappedWorkout[]> => {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("workouts")
		.select("*")
		.eq("athlete_id", userId)
		.order("started_at", { ascending: false });

	if (error || !data) {
		return [];
	}

	return (data as WorkoutRow[]).map(mapWorkoutRow);
});

const loadPlannedWorkoutRows = cache(
	async (
		userId: string,
		from: string,
		to: string,
		status?: string,
	): Promise<MappedPlannedWorkout[]> => {
		const supabase = await createClient();
		let query = supabase
			.from("planned_workouts")
			.select("*")
			.eq("athlete_id", userId)
			.gte("planned_date", from)
			.lte("planned_date", to)
			.order("planned_date", { ascending: true })
			.order("planned_time", { ascending: true });

		if (status) {
			query = query.eq("status", status);
		}

		const { data, error } = await query;
		if (error || !data) {
			return [];
		}

		return (data as PlannedWorkoutRow[]).map(mapPlannedWorkoutRow);
	},
);

const loadConversationRows = cache(async (userId: string) => {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("conversations")
		.select("id, title, created_at, messages(count)")
		.eq("athlete_id", userId)
		.order("created_at", { ascending: false })
		.limit(20);

	if (error || !data) {
		return [];
	}

	return (data ?? []).map((conversation) => ({
		id: conversation.id,
		title: conversation.title,
		created_at: conversation.created_at,
		message_count: (conversation.messages as Array<{ count: number }>)?.[0]?.count ?? 0,
	}));
});

export async function loadWorkoutsPageBootstrap(userId: string): Promise<WorkoutsPageBootstrap> {
	return {
		workouts: await loadWorkoutRows(userId),
	};
}

export async function loadCoachPageBootstrap(userId: string): Promise<CoachPageBootstrap> {
	return {
		conversations: await loadConversationRows(userId),
	};
}

export async function loadWorkoutCenterBootstrap(userId: string): Promise<WorkoutCenterBootstrap> {
	const { from, to } = getWideRange();
	const [allWorkouts, draftSessions, plannedSessions] = await Promise.all([
		loadWorkoutRows(userId),
		loadPlannedWorkoutRows(userId, from, to, "in_progress"),
		loadPlannedWorkoutRows(userId, from, to),
	]);

	return {
		allWorkouts,
		draftSessions,
		plannedSessions,
	};
}
