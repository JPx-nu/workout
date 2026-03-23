/**
 * use-planned-workouts — Fetches planned workouts for a date range
 * from the REST API. Used by the training calendar to display events.
 */

"use client";

import { type MappedPlannedWorkout, mapPlannedWorkoutRow } from "@triathlon/core";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { getApiConfigurationError, getApiUrl } from "@/lib/constants";

export type PlannedWorkout = MappedPlannedWorkout;

export function usePlannedWorkouts(
	from: string,
	to: string,
	status?: string,
	initialWorkouts: PlannedWorkout[] = [],
) {
	const { session } = useAuth();
	const [workouts, setWorkouts] = useState<PlannedWorkout[]>(initialWorkouts);
	const [isHydrating, setIsHydrating] = useState(initialWorkouts.length === 0);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkouts = useCallback(
		async (options?: { background?: boolean }) => {
			if (!session?.access_token || !from || !to) {
				setIsHydrating(false);
				setIsRefreshing(false);
				return;
			}

			const background = options?.background ?? workouts.length > 0;
			if (background) {
				setIsRefreshing(true);
			} else {
				setIsHydrating(true);
			}
			setError(null);

			try {
				const configError = getApiConfigurationError();
				if (configError) {
					throw new Error(configError);
				}

				const query = new URLSearchParams({
					from,
					to,
					...(status ? { status } : {}),
				});

				const res = await fetch(getApiUrl(`/api/planned-workouts?${query.toString()}`), {
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
				});

				if (!res.ok) {
					throw new Error(`Failed to fetch: ${res.status}`);
				}

				const json = await res.json();
				setWorkouts((json.data || []).map(mapPlannedWorkoutRow));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch workouts");
			} finally {
				if (background) {
					setIsRefreshing(false);
				} else {
					setIsHydrating(false);
				}
			}
		},
		[from, session?.access_token, status, to, workouts.length],
	);

	useEffect(() => {
		if (!session?.access_token || !from || !to) {
			if (initialWorkouts.length === 0) {
				setIsHydrating(false);
			}
			return;
		}

		void fetchWorkouts({ background: initialWorkouts.length > 0 });
	}, [fetchWorkouts, from, initialWorkouts.length, session?.access_token, to]);

	const updateWorkout = useCallback(
		async (
			id: string,
			updates: Partial<Omit<PlannedWorkout, "id" | "athleteId" | "createdAt" | "updatedAt">>,
		) => {
			if (!session?.access_token) return;

			try {
				const configError = getApiConfigurationError();
				if (configError) {
					throw new Error(configError);
				}

				const res = await fetch(getApiUrl(`/api/planned-workouts/${id}`), {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(updates),
				});

				if (!res.ok) throw new Error(`Update failed: ${res.status}`);

				const json = await res.json();
				const updated = mapPlannedWorkoutRow(json.data);
				setWorkouts((current) => current.map((workout) => (workout.id === id ? updated : workout)));
				return updated;
			} catch (err) {
				setError(err instanceof Error ? err.message : "Update failed");
			}
		},
		[session?.access_token],
	);

	const deleteWorkout = useCallback(
		async (id: string) => {
			if (!session?.access_token) return;

			try {
				const configError = getApiConfigurationError();
				if (configError) {
					throw new Error(configError);
				}

				const res = await fetch(getApiUrl(`/api/planned-workouts/${id}`), {
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
				});

				if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

				setWorkouts((current) => current.filter((workout) => workout.id !== id));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Delete failed");
			}
		},
		[session?.access_token],
	);

	return {
		workouts,
		isLoading: isHydrating,
		isHydrating,
		isRefreshing,
		error,
		refetch: () => fetchWorkouts({ background: workouts.length > 0 }),
		setWorkouts,
		updateWorkout,
		deleteWorkout,
	};
}
