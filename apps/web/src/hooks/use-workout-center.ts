"use client";

import type {
	CompletedWorkoutInput,
	CompletedWorkoutUpdate,
	PlannedWorkoutInput,
	PlannedWorkoutUpdate,
} from "@triathlon/types";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { getApiConfigurationError, getApiUrl } from "@/lib/constants";

type MutationState = {
	isSaving: boolean;
	error: string | null;
};

export function useWorkoutCenter() {
	const { session } = useAuth();
	const [state, setState] = useState<MutationState>({
		isSaving: false,
		error: null,
	});

	const request = useCallback(
		async <T>(path: string, init?: RequestInit): Promise<T> => {
			if (!session?.access_token) {
				throw new Error("Not authenticated");
			}

			const configError = getApiConfigurationError();
			if (configError) {
				throw new Error(configError);
			}

			const response = await fetch(getApiUrl(path), {
				...init,
				headers: {
					Authorization: `Bearer ${session.access_token}`,
					"Content-Type": "application/json",
					...(init?.headers ?? {}),
				},
			});

			const json = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
			if (!response.ok) {
				throw new Error(json.error ?? `Request failed (${response.status})`);
			}

			return json.data as T;
		},
		[session?.access_token],
	);

	const runMutation = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
		setState({ isSaving: true, error: null });
		try {
			const result = await fn();
			setState({ isSaving: false, error: null });
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Request failed";
			setState({ isSaving: false, error: message });
			throw error;
		}
	}, []);

	return {
		...state,
		clearError: () => setState((prev) => ({ ...prev, error: null })),
		createCompletedWorkout: (payload: CompletedWorkoutInput) =>
			runMutation(() =>
				request<{ id: string }>("/api/workouts", {
					method: "POST",
					body: JSON.stringify(payload),
				}),
			),
		updateCompletedWorkout: (id: string, payload: CompletedWorkoutUpdate) =>
			runMutation(() =>
				request<{ id: string }>(`/api/workouts/${id}`, {
					method: "PATCH",
					body: JSON.stringify(payload),
				}),
			),
		createPlannedWorkout: (payload: PlannedWorkoutInput) =>
			runMutation(() =>
				request<{ id: string }>("/api/planned-workouts", {
					method: "POST",
					body: JSON.stringify(payload),
				}),
			),
		updatePlannedWorkout: (id: string, payload: PlannedWorkoutUpdate) =>
			runMutation(() =>
				request<{ id: string }>(`/api/planned-workouts/${id}`, {
					method: "PATCH",
					body: JSON.stringify(payload),
				}),
			),
		schedulePlannedWorkouts: (payload: { workouts: PlannedWorkoutInput[] }) =>
			runMutation(() =>
				request<Array<{ id: string }>>("/api/planned-workouts/batch", {
					method: "POST",
					body: JSON.stringify(payload),
				}),
			),
	};
}
