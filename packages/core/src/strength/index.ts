import {
	type MuscleGroup,
	type StrengthExercise,
	type StrengthExerciseCatalogItem,
	type StrengthSessionV1,
	StrengthSessionV1Schema,
	type StrengthSet,
	type StrengthSetType,
} from "@triathlon/types";
import { findStrengthExerciseCatalogItem } from "./catalog.js";

export interface SetData {
	reps: number;
	weight_kg: number;
	rpe?: number;
	rir?: number;
	tempo?: string;
	set_type?: "working" | "warmup" | "dropset" | "backoff" | "amrap" | "cluster";
}

export interface ExerciseData {
	name: string;
	sets: SetData[];
	group_id?: number;
	group_type?: "superset" | "circuit" | "giant_set";
	notes?: string;
}

export interface ExerciseSummary {
	name: string;
	workingSets: number;
	topSet: { weight_kg: number; reps: number; rpe?: number } | null;
	totalVolume_kg: number;
	estimated1RM_kg: number | null;
	group_id?: number;
	group_type?: string;
}

type LegacyUiSet = {
	id?: string;
	weightKg?: number;
	reps?: number;
	rpe?: number;
	type?: "warmup" | "working" | "failure" | "drop";
};

type LegacyUiExercise = {
	id?: string;
	name?: string;
	muscleGroup?: MuscleGroup;
	sets?: LegacyUiSet[];
	notes?: string;
};

type LegacyUiStrengthSessionData = {
	focus?: string;
	exercises?: LegacyUiExercise[];
};

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function mapLegacySetType(type: string | undefined): StrengthSetType {
	switch (type) {
		case "warmup":
		case "working":
		case "dropset":
		case "backoff":
		case "amrap":
		case "cluster":
			return type;
		case "drop":
			return "dropset";
		case "failure":
			return "amrap";
		default:
			return "working";
	}
}

function normalizeSetFromLegacySnake(set: SetData, index: number): StrengthSet {
	return {
		id: `set-${index + 1}`,
		order: index + 1,
		setType: mapLegacySetType(set.set_type),
		completed: true,
		reps: set.reps,
		weightKg: set.weight_kg,
		rpe: set.rpe,
		rir: set.rir,
		tempo: set.tempo,
	};
}

function normalizeSetFromLegacyUi(set: LegacyUiSet, index: number): StrengthSet {
	return {
		id: set.id ?? `set-${index + 1}`,
		order: index + 1,
		setType: mapLegacySetType(set.type),
		completed: true,
		reps: set.reps ?? 0,
		weightKg: set.weightKg ?? 0,
		rpe: set.rpe,
	};
}

function buildExerciseFromCatalog(
	name: string,
	catalogItem: StrengthExerciseCatalogItem | null,
): Pick<
	StrengthExercise,
	"catalogId" | "displayName" | "isCustom" | "equipment" | "movementPattern" | "primaryMuscleGroups"
> {
	return {
		catalogId: catalogItem?.id,
		displayName: catalogItem?.displayName ?? name,
		isCustom: !catalogItem,
		equipment: catalogItem?.equipment[0] ?? "other",
		movementPattern: catalogItem?.movementPattern ?? "other",
		primaryMuscleGroups: catalogItem?.primaryMuscleGroups ?? ["full"],
	};
}

function normalizeFromLegacySnake(rawData: Record<string, unknown>): StrengthSessionV1 | null {
	const rawExercises = rawData.exercises;
	if (!Array.isArray(rawExercises)) {
		return null;
	}

	const exercises = rawExercises
		.map<StrengthExercise | null>((exercise, index) => {
			if (!isObject(exercise)) {
				return null;
			}

			const name = typeof exercise.name === "string" ? exercise.name : `Exercise ${index + 1}`;
			const sets = Array.isArray(exercise.sets)
				? (exercise.sets as SetData[]).map(normalizeSetFromLegacySnake)
				: [];
			const catalogItem = findStrengthExerciseCatalogItem(name);
			return {
				id: `exercise-${index + 1}`,
				...buildExerciseFromCatalog(name, catalogItem),
				notes: typeof exercise.notes === "string" ? exercise.notes : undefined,
				restSec: undefined,
				groupId:
					typeof exercise.group_id === "number" && Number.isFinite(exercise.group_id)
						? exercise.group_id
						: undefined,
				groupType:
					exercise.group_type === "superset" ||
					exercise.group_type === "circuit" ||
					exercise.group_type === "giant_set"
						? exercise.group_type
						: undefined,
				sets,
			};
		})
		.filter((exercise): exercise is StrengthExercise => exercise !== null);

	return {
		schemaVersion: 1,
		activityType: "STRENGTH",
		mode: "log_past",
		status: "completed",
		source:
			isObject(rawData.metadata) &&
			(rawData.metadata.source === "AI" ||
				rawData.metadata.source === "COACH" ||
				rawData.metadata.source === "MANUAL")
				? rawData.metadata.source
				: "MANUAL",
		focus: typeof rawData.focus === "string" ? rawData.focus : undefined,
		sessionNotes: typeof rawData.notes === "string" ? rawData.notes : undefined,
		exercises,
	};
}

function normalizeFromLegacyUi(rawData: Record<string, unknown>): StrengthSessionV1 | null {
	const data = rawData as LegacyUiStrengthSessionData;
	if (!Array.isArray(data.exercises)) {
		return null;
	}

	const exercises: StrengthExercise[] = data.exercises.map((exercise, index) => {
		const name = exercise.name ?? `Exercise ${index + 1}`;
		const catalogItem = findStrengthExerciseCatalogItem(name);
		return {
			id: exercise.id ?? `exercise-${index + 1}`,
			...buildExerciseFromCatalog(name, catalogItem),
			primaryMuscleGroups:
				exercise.muscleGroup && !catalogItem
					? [exercise.muscleGroup]
					: buildExerciseFromCatalog(name, catalogItem).primaryMuscleGroups,
			notes: exercise.notes,
			restSec: undefined,
			sets: (exercise.sets ?? []).map(normalizeSetFromLegacyUi),
		};
	});

	return {
		schemaVersion: 1,
		activityType: "STRENGTH",
		mode: "log_past",
		status: "completed",
		source: "MANUAL",
		focus: data.focus,
		exercises,
	};
}

export function normalizeStrengthSession(rawData: unknown): StrengthSessionV1 | null {
	if (!isObject(rawData)) {
		return null;
	}

	const parsed = StrengthSessionV1Schema.safeParse(rawData);
	if (parsed.success) {
		return parsed.data;
	}

	const rawExercises = rawData.exercises;
	if (Array.isArray(rawExercises) && rawExercises.length > 0) {
		const firstExercise = rawExercises[0];
		if (isObject(firstExercise) && Array.isArray(firstExercise.sets)) {
			const firstSet = firstExercise.sets[0];
			if (isObject(firstSet) && "weight_kg" in firstSet) {
				return normalizeFromLegacySnake(rawData);
			}
			if (isObject(firstSet) && "weightKg" in firstSet) {
				return normalizeFromLegacyUi(rawData);
			}
		}
	}

	return null;
}

export function strengthSessionToLegacyExercises(session: StrengthSessionV1): ExerciseData[] {
	return session.exercises.map((exercise) => ({
		name: exercise.displayName,
		notes: exercise.notes,
		group_id: exercise.groupId,
		group_type: exercise.groupType,
		sets: exercise.sets.map((set) => ({
			reps: set.reps ?? 0,
			weight_kg: set.weightKg ?? 0,
			rpe: set.rpe,
			rir: set.rir,
			tempo: set.tempo,
			set_type: set.setType,
		})),
	}));
}

export function estimate1RM(weight: number, reps: number): number | null {
	if (weight <= 0 || reps <= 0) return null;
	if (reps === 1) return weight;

	let estimate: number;

	if (reps <= 6) {
		const denominator = 1.0278 - 0.0278 * reps;
		if (denominator <= 0) return null;
		estimate = weight / denominator;
	} else if (reps <= 10) {
		estimate = weight * (1 + reps / 30);
	} else {
		estimate = weight * reps ** 0.1;
	}

	return Math.round(estimate * 10) / 10;
}

export function computeVolume(sets: SetData[]): number {
	return sets
		.filter((s) => s.set_type !== "warmup")
		.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
}

export function findTopSet(sets: SetData[]): SetData | null {
	const workingSets = sets.filter((s) => s.set_type !== "warmup");
	if (workingSets.length === 0) return null;

	let best: SetData | null = null;
	let bestE1RM = 0;

	for (const set of workingSets) {
		const estimated = estimate1RM(set.weight_kg, set.reps);
		if (estimated !== null && estimated > bestE1RM) {
			bestE1RM = estimated;
			best = set;
		}
	}

	return best;
}

export function summarizeStrengthWorkout(rawData: unknown): ExerciseSummary[] {
	const session = normalizeStrengthSession(rawData);
	if (!session) {
		return [];
	}

	return strengthSessionToLegacyExercises(session).map((exercise) => {
		const workingSets = exercise.sets.filter((set) => set.set_type !== "warmup");
		const topSet = findTopSet(exercise.sets);
		const totalVolume = computeVolume(exercise.sets);
		const estimated = topSet ? estimate1RM(topSet.weight_kg, topSet.reps) : null;

		return {
			name: exercise.name,
			workingSets: workingSets.length,
			topSet: topSet
				? {
						weight_kg: topSet.weight_kg,
						reps: topSet.reps,
						rpe: topSet.rpe,
					}
				: null,
			totalVolume_kg: totalVolume,
			estimated1RM_kg: estimated,
			...(exercise.group_id !== undefined ? { group_id: exercise.group_id } : {}),
			...(exercise.group_type ? { group_type: exercise.group_type } : {}),
		};
	});
}

export function computeAverageRPE(exercises: ExerciseData[]): number | null {
	const rpeValues: number[] = [];
	for (const exercise of exercises) {
		for (const set of exercise.sets) {
			if (set.set_type !== "warmup" && set.rpe !== undefined) {
				rpeValues.push(set.rpe);
			}
		}
	}
	if (rpeValues.length === 0) return null;
	return Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10;
}

export function computeSessionVolume(exercises: ExerciseData[]): number {
	return exercises.reduce((sum, exercise) => sum + computeVolume(exercise.sets), 0);
}

export type StrengthMetrics = {
	weeklyVolumeLoad: number;
	avgDensity: number;
	muscleSplit: Record<string, number>;
};

export type StrengthWorkoutLike = {
	activityType: string;
	startedAt: string;
	durationSec: number;
	rawData?: unknown;
};

export function computeStrengthMetrics(workouts: StrengthWorkoutLike[]): StrengthMetrics {
	const now = Date.now();
	const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
	const thisWeek = workouts
		.filter((w) => new Date(w.startedAt).getTime() >= weekAgo)
		.filter((w) => w.activityType === "STRENGTH");

	let totalVolume = 0;
	let totalDensity = 0;
	const muscleSplit: Record<string, number> = {};

	for (const workout of thisWeek) {
		const session = normalizeStrengthSession(workout.rawData);
		if (!session?.exercises?.length) {
			continue;
		}

		let sessionVolume = 0;
		for (const exercise of session.exercises) {
			for (const muscleGroup of exercise.primaryMuscleGroups) {
				muscleSplit[muscleGroup] = (muscleSplit[muscleGroup] || 0) + exercise.sets.length;
			}
			for (const set of exercise.sets) {
				if (set.setType === "warmup") {
					continue;
				}
				sessionVolume += (set.weightKg ?? 0) * (set.reps ?? 0);
			}
		}

		totalVolume += sessionVolume;
		if (workout.durationSec > 0) {
			totalDensity += sessionVolume / (workout.durationSec / 60);
		}
	}

	return {
		weeklyVolumeLoad: totalVolume,
		avgDensity: thisWeek.length > 0 ? Math.round(totalDensity / thisWeek.length) : 0,
		muscleSplit,
	};
}
