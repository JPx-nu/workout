"use client";

import {
	findStrengthExerciseCatalogItem,
	type MappedPlannedWorkout,
	type MappedWorkout,
	normalizeStrengthSession,
} from "@triathlon/core";
import type {
	ActivityType,
	CompletedWorkoutInput,
	PlannedWorkoutInput,
	StrengthExercise,
	StrengthExerciseCatalogItem,
	StrengthSessionMode,
	StrengthSessionStatus,
	StrengthSessionV1,
	StrengthSet,
} from "@triathlon/types";

export type WorkoutCenterMode = StrengthSessionMode;
export type WorkoutCenterIntensity = "RECOVERY" | "EASY" | "MODERATE" | "HARD" | "MAX";

export type WorkoutCenterFormState = {
	mode: WorkoutCenterMode;
	activityType: ActivityType;
	title: string;
	description: string;
	notes: string;
	focus: string;
	date: string;
	time: string;
	durationMin: string;
	distanceKm: string;
	avgHr: string;
	tss: string;
	intensity: WorkoutCenterIntensity | "";
	targetRpe: string;
	exercises: StrengthExercise[];
};

export type PreviousStrengthExercise = {
	workoutId: string;
	startedAt: string;
	displayName: string;
	notes?: string;
	sets: StrengthSet[];
};

function createId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

export function toDateInputValue(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeToInputValue(date: Date): string {
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInteger(value: string): number | undefined {
	const parsed = parseNumber(value);
	if (parsed === undefined) {
		return undefined;
	}

	return Math.round(parsed);
}

function combineDateAndTime(date: string, time: string): string {
	if (!date) {
		return new Date().toISOString();
	}

	const normalizedTime = time || "08:00";
	return new Date(`${date}T${normalizedTime}:00`).toISOString();
}

function splitIsoDateTime(value?: string | null): { date: string; time: string } {
	if (!value) {
		const now = new Date();
		return {
			date: toDateInputValue(now),
			time: timeToInputValue(now),
		};
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		const fallback = new Date();
		return {
			date: toDateInputValue(fallback),
			time: timeToInputValue(fallback),
		};
	}

	return {
		date: toDateInputValue(date),
		time: timeToInputValue(date),
	};
}

export function createEmptyStrengthSet(order = 1): StrengthSet {
	return {
		id: createId("set"),
		order,
		setType: "working",
		completed: false,
	};
}

export function createExerciseFromCatalog(
	itemOrName?: StrengthExerciseCatalogItem | string,
): StrengthExercise {
	const catalogItem =
		typeof itemOrName === "string"
			? findStrengthExerciseCatalogItem(itemOrName)
			: (itemOrName ?? null);
	const fallbackName = typeof itemOrName === "string" ? itemOrName.trim() : "";

	return {
		id: createId("exercise"),
		catalogId: catalogItem?.id,
		displayName: catalogItem?.displayName ?? (fallbackName || "Custom Exercise"),
		isCustom: !catalogItem,
		equipment: catalogItem?.equipment[0] ?? "other",
		movementPattern: catalogItem?.movementPattern ?? "other",
		primaryMuscleGroups: catalogItem?.primaryMuscleGroups ?? ["full"],
		sets: [createEmptyStrengthSet(1)],
	};
}

export function createEmptyWorkoutForm(
	mode: WorkoutCenterMode,
	activityType: ActivityType = "STRENGTH",
): WorkoutCenterFormState {
	const now = new Date();
	return {
		mode,
		activityType,
		title: "",
		description: "",
		notes: "",
		focus: "",
		date: toDateInputValue(now),
		time: timeToInputValue(now),
		durationMin: "",
		distanceKm: "",
		avgHr: "",
		tss: "",
		intensity: "",
		targetRpe: "",
		exercises: activityType === "STRENGTH" ? [] : [],
	};
}

export function deriveSessionTitle(form: WorkoutCenterFormState): string {
	const explicitTitle = form.title.trim();
	if (explicitTitle) {
		return explicitTitle;
	}

	if (form.activityType === "STRENGTH") {
		const focus = form.focus.trim();
		if (focus) {
			return focus;
		}

		const exerciseNames = form.exercises
			.map((exercise) => exercise.displayName.trim())
			.filter(Boolean)
			.slice(0, 2);

		if (exerciseNames.length > 0) {
			return exerciseNames.join(" + ");
		}

		return "Strength Session";
	}

	return `${form.activityType.charAt(0)}${form.activityType.slice(1).toLowerCase()} Session`;
}

export function buildStrengthSession(
	form: WorkoutCenterFormState,
	status: StrengthSessionStatus,
): StrengthSessionV1 {
	const startedAt = combineDateAndTime(form.date, form.time);
	const durationMin = parseInteger(form.durationMin);
	return {
		schemaVersion: 1,
		activityType: "STRENGTH",
		mode: form.mode,
		status,
		source: "MANUAL",
		focus: form.focus.trim() || deriveSessionTitle(form),
		startedAt: form.mode === "schedule" ? undefined : startedAt,
		plannedDate: form.date || undefined,
		plannedTime: form.time || undefined,
		durationSec: durationMin !== undefined ? durationMin * 60 : undefined,
		sessionNotes: form.notes.trim() || undefined,
		exercises: form.exercises.map((exercise) => ({
			...exercise,
			notes: exercise.notes?.trim() || undefined,
			sets: exercise.sets.map((set, index) => ({
				...set,
				order: index + 1,
				completed: status === "completed" ? true : set.completed,
			})),
		})),
	};
}

export function buildCompletedWorkoutPayload(
	form: WorkoutCenterFormState,
	options?: { plannedWorkoutId?: string },
): CompletedWorkoutInput {
	const durationMin = parseInteger(form.durationMin);
	const distanceKm = parseNumber(form.distanceKm);
	const payload: CompletedWorkoutInput = {
		activityType: form.activityType,
		startedAt: combineDateAndTime(form.date, form.time),
		durationSec: durationMin !== undefined ? durationMin * 60 : undefined,
		distanceM: distanceKm !== undefined ? distanceKm * 1000 : undefined,
		avgHr: parseInteger(form.avgHr),
		tss: parseNumber(form.tss),
		notes: form.notes.trim() || undefined,
		plannedWorkoutId: options?.plannedWorkoutId,
	};

	if (form.activityType === "STRENGTH") {
		payload.strengthSession = buildStrengthSession(form, "completed");
	}

	if (form.description.trim() && form.activityType !== "STRENGTH") {
		payload.rawData = {
			title: deriveSessionTitle(form),
			description: form.description.trim(),
			intensity: form.intensity || undefined,
			targetRpe: parseInteger(form.targetRpe),
		};
	}

	return payload;
}

export function buildPlannedWorkoutPayload(
	form: WorkoutCenterFormState,
	status: "planned" | "in_progress",
): PlannedWorkoutInput {
	const payload: PlannedWorkoutInput = {
		plannedDate: form.date,
		plannedTime: form.time || undefined,
		activityType: form.activityType,
		title: deriveSessionTitle(form),
		description: form.description.trim() || undefined,
		durationMin: parseInteger(form.durationMin),
		distanceKm: parseNumber(form.distanceKm),
		targetRpe: parseInteger(form.targetRpe),
		intensity: form.intensity || undefined,
		notes: form.notes.trim() || undefined,
		source: "MANUAL",
		status,
	};

	if (form.activityType === "STRENGTH") {
		payload.sessionData = buildStrengthSession(form, status);
	} else if (form.description.trim() || form.notes.trim()) {
		payload.sessionData = {
			title: deriveSessionTitle(form),
			description: form.description.trim() || undefined,
			notes: form.notes.trim() || undefined,
		};
	}

	return payload;
}

export function hydrateFormFromWorkout(workout: MappedWorkout): WorkoutCenterFormState {
	const { date, time } = splitIsoDateTime(workout.startedAt);
	const session = normalizeStrengthSession(workout.rawData);

	if (workout.activityType === "STRENGTH" && session) {
		return {
			mode: "log_past",
			activityType: "STRENGTH",
			title: session.focus ?? "",
			description: "",
			notes: workout.notes ?? session.sessionNotes ?? "",
			focus: session.focus ?? "",
			date,
			time,
			durationMin: workout.durationSec ? String(Math.round(workout.durationSec / 60)) : "",
			distanceKm: workout.distanceM ? String(workout.distanceM / 1000) : "",
			avgHr: workout.avgHr ? String(workout.avgHr) : "",
			tss: workout.tss ? String(workout.tss) : "",
			intensity: "",
			targetRpe: "",
			exercises: session.exercises,
		};
	}

	return {
		mode: "log_past",
		activityType: workout.activityType,
		title: "",
		description:
			typeof workout.rawData?.description === "string" ? workout.rawData.description : "",
		notes: workout.notes ?? "",
		focus: "",
		date,
		time,
		durationMin: workout.durationSec ? String(Math.round(workout.durationSec / 60)) : "",
		distanceKm: workout.distanceM ? String(workout.distanceM / 1000) : "",
		avgHr: workout.avgHr ? String(workout.avgHr) : "",
		tss: workout.tss ? String(workout.tss) : "",
		intensity:
			typeof workout.rawData?.intensity === "string"
				? (workout.rawData.intensity as WorkoutCenterIntensity)
				: "",
		targetRpe:
			typeof workout.rawData?.targetRpe === "number" ? String(workout.rawData.targetRpe) : "",
		exercises: workout.activityType === "STRENGTH" ? [] : [],
	};
}

export function hydrateFormFromPlannedWorkout(
	workout: MappedPlannedWorkout,
): WorkoutCenterFormState {
	const session = normalizeStrengthSession(workout.sessionData);
	const mode: WorkoutCenterMode = workout.status === "in_progress" ? "start_now" : "schedule";

	if (workout.activityType === "STRENGTH" && session) {
		return {
			mode,
			activityType: "STRENGTH",
			title: workout.title,
			description: workout.description ?? "",
			notes: workout.notes ?? session.sessionNotes ?? "",
			focus: session.focus ?? workout.title,
			date: workout.plannedDate,
			time: workout.plannedTime ?? "",
			durationMin: workout.durationMin ? String(workout.durationMin) : "",
			distanceKm: workout.distanceKm ? String(workout.distanceKm) : "",
			avgHr: "",
			tss: workout.targetTss ? String(workout.targetTss) : "",
			intensity: (workout.intensity as WorkoutCenterIntensity | null) ?? "",
			targetRpe: workout.targetRpe ? String(workout.targetRpe) : "",
			exercises: session.exercises,
		};
	}

	return {
		mode,
		activityType: workout.activityType as ActivityType,
		title: workout.title,
		description: workout.description ?? "",
		notes: workout.notes ?? "",
		focus: "",
		date: workout.plannedDate,
		time: workout.plannedTime ?? "",
		durationMin: workout.durationMin ? String(workout.durationMin) : "",
		distanceKm: workout.distanceKm ? String(workout.distanceKm) : "",
		avgHr: "",
		tss: workout.targetTss ? String(workout.targetTss) : "",
		intensity: (workout.intensity as WorkoutCenterIntensity | null) ?? "",
		targetRpe: workout.targetRpe ? String(workout.targetRpe) : "",
		exercises: workout.activityType === "STRENGTH" ? [] : [],
	};
}

export function buildPreviousStrengthMap(
	workouts: MappedWorkout[],
): Record<string, PreviousStrengthExercise> {
	const lookup: Record<string, PreviousStrengthExercise> = {};

	for (const workout of workouts) {
		if (workout.activityType !== "STRENGTH") {
			continue;
		}

		const session = normalizeStrengthSession(workout.rawData);
		if (!session) {
			continue;
		}

		for (const exercise of session.exercises) {
			const key = exercise.catalogId ?? exercise.displayName.toLowerCase();
			if (lookup[key]) {
				continue;
			}

			lookup[key] = {
				workoutId: workout.id,
				startedAt: workout.startedAt,
				displayName: exercise.displayName,
				notes: exercise.notes,
				sets: exercise.sets,
			};
		}
	}

	return lookup;
}

export function isFormMeaningful(form: WorkoutCenterFormState): boolean {
	if (form.activityType === "STRENGTH") {
		return form.exercises.some((exercise) => {
			const hasName = exercise.displayName.trim().length > 0;
			const hasSetData = exercise.sets.some(
				(set) =>
					set.reps !== undefined ||
					set.weightKg !== undefined ||
					set.rpe !== undefined ||
					set.rir !== undefined ||
					set.tempo !== undefined,
			);
			return hasName || hasSetData;
		});
	}

	return Boolean(
		form.title.trim() ||
			form.description.trim() ||
			form.notes.trim() ||
			form.durationMin.trim() ||
			form.distanceKm.trim(),
	);
}
