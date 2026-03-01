// ============================================================
// Service hook: useWorkouts
// Fetches from Supabase workouts table, computes stats & chart data
// ============================================================

import {
	computeChartData,
	computeStrengthMetrics,
	computeWeeklyStats,
	type MappedWorkout,
	mapWorkoutRow,
	type WorkoutRow,
} from "@triathlon/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";

type ActivityFilter = "ALL" | "SWIM" | "BIKE" | "RUN" | "STRENGTH";

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
