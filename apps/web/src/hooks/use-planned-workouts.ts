/**
 * use-planned-workouts — Fetches planned workouts for a date range
 * from the REST API. Used by the training calendar to display events.
 */

"use client";

import { type MappedPlannedWorkout, mapPlannedWorkoutRow } from "@triathlon/core";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { API_URL } from "@/lib/constants";

export type PlannedWorkout = MappedPlannedWorkout;

export function usePlannedWorkouts(from: string, to: string) {
	const { session } = useAuth();
	const [workouts, setWorkouts] = useState<PlannedWorkout[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchWorkouts = useCallback(async () => {
		if (!session?.access_token || !from || !to) {
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const res = await fetch(`${API_URL}/api/planned-workouts?from=${from}&to=${to}`, {
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
			setIsLoading(false);
		}
	}, [session?.access_token, from, to]);

	useEffect(() => {
		fetchWorkouts();
	}, [fetchWorkouts]);

	// ── Mutations ──────────────────────────────────────────────

	const updateWorkout = useCallback(
		async (
			id: string,
			updates: Partial<Omit<PlannedWorkout, "id" | "athleteId" | "createdAt" | "updatedAt">>,
		) => {
			if (!session?.access_token) return;

			try {
				const res = await fetch(`${API_URL}/api/planned-workouts/${id}`, {
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

				// Optimistic update
				setWorkouts((prev) => prev.map((w) => (w.id === id ? updated : w)));
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
				const res = await fetch(`${API_URL}/api/planned-workouts/${id}`, {
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
				});

				if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

				setWorkouts((prev) => prev.filter((w) => w.id !== id));
			} catch (err) {
				setError(err instanceof Error ? err.message : "Delete failed");
			}
		},
		[session?.access_token],
	);

	return {
		workouts,
		isLoading,
		error,
		refetch: fetchWorkouts,
		updateWorkout,
		deleteWorkout,
	};
}
