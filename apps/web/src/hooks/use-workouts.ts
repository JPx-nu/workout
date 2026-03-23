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

export function useWorkouts(initialWorkouts: MappedWorkout[] = []) {
	const { user } = useAuth();
	const [filter, setFilter] = useState<ActivityFilter>("ALL");
	const [allWorkouts, setAllWorkouts] = useState<MappedWorkout[]>(initialWorkouts);
	const [isHydrating, setIsHydrating] = useState(initialWorkouts.length === 0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkouts = useCallback(
		async (options?: { background?: boolean }) => {
			if (!user) {
				if (initialWorkouts.length === 0) {
					setAllWorkouts([]);
				}
				setIsHydrating(false);
				setIsRefreshing(false);
				return;
			}

			const background = options?.background ?? allWorkouts.length > 0;
			if (background) {
				setIsRefreshing(true);
			} else {
				setIsHydrating(true);
			}
			setError(null);

			const supabase = createClient();
			const { data, error: dbError } = await supabase
				.from("workouts")
				.select("*")
				.eq("athlete_id", user.id)
				.order("started_at", { ascending: false });

			if (dbError) {
				setError(dbError.message);
			} else {
				setAllWorkouts((data as WorkoutRow[]).map(mapWorkoutRow));
			}

			if (background) {
				setIsRefreshing(false);
			} else {
				setIsHydrating(false);
			}
		},
		[allWorkouts.length, initialWorkouts.length, user],
	);

	useEffect(() => {
		if (!user) {
			if (initialWorkouts.length === 0) {
				setIsHydrating(false);
			}
			return;
		}

		void fetchWorkouts({ background: initialWorkouts.length > 0 });
	}, [fetchWorkouts, initialWorkouts.length, user]);

	const filtered = useMemo(() => {
		if (filter === "ALL") return allWorkouts;
		return allWorkouts.filter((workout) => workout.activityType === filter);
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
		isLoading: isHydrating,
		isHydrating,
		isRefreshing,
		error,
		refetch: () => fetchWorkouts({ background: allWorkouts.length > 0 }),
	};
}
