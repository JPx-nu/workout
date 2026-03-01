// ============================================================
// Service hook: useWorkouts
// Fetches from Supabase workouts table, computes stats & chart data
// ============================================================

import {
	computeChartData,
	computeWeeklyStats,
	type MappedWorkout,
	mapWorkoutRow,
	type WorkoutRow,
} from "@triathlon/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";
import type { StrengthSessionData } from "@/lib/types";

type ActivityFilter = "ALL" | "SWIM" | "BIKE" | "RUN" | "STRENGTH";

// Re-export types from core for backward compat
export type { ChartDataPoint, WeeklyStats } from "@triathlon/core";

// ---- Compute Strength Metrics ----
type StrengthMetrics = {
	weeklyVolumeLoad: number;
	avgDensity: number;
	muscleSplit: Record<string, number>;
};

function computeStrengthMetrics(workouts: MappedWorkout[]): StrengthMetrics {
	const now = Date.now();
	const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
	const thisWeek = workouts
		.filter((w) => new Date(w.startedAt).getTime() >= weekAgo)
		.filter((w) => w.activityType === "STRENGTH");

	let totalVolume = 0;
	let totalDensity = 0;
	const muscleSplit: Record<string, number> = {};

	for (const w of thisWeek) {
		const data = w.rawData as unknown as StrengthSessionData;
		if (!data) continue;

		let sessionVolume = 0;
		for (const ex of data.exercises) {
			muscleSplit[ex.muscleGroup] = (muscleSplit[ex.muscleGroup] || 0) + ex.sets.length;
			for (const set of ex.sets) {
				sessionVolume += set.weightKg * set.reps;
			}
		}

		totalVolume += sessionVolume;
		if (w.durationSec > 0) {
			totalDensity += sessionVolume / (w.durationSec / 60);
		}
	}

	return {
		weeklyVolumeLoad: totalVolume,
		avgDensity: thisWeek.length > 0 ? Math.round(totalDensity / thisWeek.length) : 0,
		muscleSplit,
	};
}

export function useWorkouts() {
	const { user } = useAuth();
	const [filter, setFilter] = useState<ActivityFilter>("ALL");
	const [allWorkouts, setAllWorkouts] = useState<MappedWorkout[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkouts = useCallback(async () => {
		if (!user) {
			setAllWorkouts([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const supabase = createClient();
		const { data, error: dbError } = await supabase
			.from("workouts")
			.select("*")
			.eq("athlete_id", user.id)
			.order("started_at", { ascending: false });

		if (dbError) {
			setError(dbError.message);
			setAllWorkouts([]);
		} else {
			setAllWorkouts((data as WorkoutRow[]).map(mapWorkoutRow));
		}
		setIsLoading(false);
	}, [user]);

	useEffect(() => {
		fetchWorkouts();
	}, [fetchWorkouts]);

	const filtered = useMemo(() => {
		if (filter === "ALL") return allWorkouts;
		return allWorkouts.filter((w) => w.activityType === filter);
	}, [allWorkouts, filter]);

	const weeklyStats = useMemo(() => computeWeeklyStats(allWorkouts), [allWorkouts]);
	const chartData = useMemo(() => computeChartData(allWorkouts), [allWorkouts]);
	const strengthMetrics = useMemo(() => computeStrengthMetrics(allWorkouts), [allWorkouts]);

	return {
		workouts: filtered,
		allWorkouts,
		weeklyStats,
		chartData,
		strengthMetrics,
		filter,
		setFilter,
		isLoading,
		error,
	};
}

// Re-export formatters from core for backward compat
export { formatDuration, formatPace, mToKm, secToMin } from "@triathlon/core";
