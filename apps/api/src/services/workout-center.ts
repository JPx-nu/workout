import type { SupabaseClient } from "@supabase/supabase-js";
import { findStrengthExerciseCatalogItem, normalizeStrengthSession } from "@triathlon/core";
import type {
	CompletedWorkoutInput,
	CompletedWorkoutUpdate,
	PlannedWorkoutInput,
	PlannedWorkoutUpdate,
	StrengthSessionV1,
} from "@triathlon/types";
import { createLogger } from "../lib/logger.js";
import { createEmbeddings } from "./ai/utils/embeddings.js";

const log = createLogger({ module: "workout-center-service" });

type PlannedWorkoutRow = {
	id: string;
	workout_id: string | null;
	planned_date: string;
	planned_time: string | null;
	activity_type: string;
	title: string;
	description: string | null;
	duration_min: number | null;
	distance_km: number | null;
	target_tss: number | null;
	target_rpe: number | null;
	intensity: string | null;
	session_data: Record<string, unknown> | null;
	status: string;
	sort_order: number;
	notes: string | null;
	coach_notes: string | null;
	source: string;
	plan_id: string | null;
	created_at: string;
	updated_at: string;
};

type WorkoutRow = {
	id: string;
	activity_type: string;
	started_at: string;
	raw_data: Record<string, unknown> | null;
};

function prepareStrengthSessionForCompleted(
	input: Pick<
		CompletedWorkoutInput,
		"activityType" | "startedAt" | "durationSec" | "strengthSession"
	>,
): Record<string, unknown> | null {
	if (input.activityType !== "STRENGTH") {
		return null;
	}

	if (input.strengthSession) {
		return {
			...input.strengthSession,
			startedAt: input.strengthSession.startedAt ?? input.startedAt,
			durationSec: input.strengthSession.durationSec ?? input.durationSec,
			status: "completed",
			mode: input.strengthSession.mode ?? "log_past",
		};
	}

	return null;
}

function prepareStrengthSessionForPlanned(
	input: Pick<
		PlannedWorkoutInput | PlannedWorkoutUpdate,
		"activityType" | "plannedDate" | "plannedTime" | "sessionData" | "status"
	>,
): Record<string, unknown> | undefined {
	if (input.activityType !== "STRENGTH" || !input.sessionData) {
		return input.sessionData as Record<string, unknown> | undefined;
	}

	const normalized = normalizeStrengthSession(input.sessionData);
	if (!normalized) {
		return input.sessionData as Record<string, unknown>;
	}

	return {
		...normalized,
		mode: normalized.mode ?? (input.status === "in_progress" ? "start_now" : "schedule"),
		status:
			input.status === "completed" || input.status === "in_progress" || input.status === "planned"
				? input.status
				: normalized.status,
		plannedDate:
			"plannedDate" in input
				? (input.plannedDate ?? normalized.plannedDate)
				: normalized.plannedDate,
		plannedTime:
			"plannedTime" in input
				? (input.plannedTime ?? normalized.plannedTime)
				: normalized.plannedTime,
	};
}

async function maybeCreateWorkoutEmbedding(
	input: Pick<CompletedWorkoutInput, "activityType" | "notes" | "strengthSession">,
): Promise<number[] | undefined> {
	const hasExerciseData = input.strengthSession && input.strengthSession.exercises.length > 0;
	if (!input.notes && !hasExerciseData) {
		return undefined;
	}

	try {
		const model = createEmbeddings();
		return await model.embedQuery(
			JSON.stringify({
				activityType: input.activityType,
				notes: input.notes ?? null,
				strengthSession: input.strengthSession ?? null,
			}),
		);
	} catch (error) {
		log.warn({ err: error }, "Failed to generate workout embedding");
		return undefined;
	}
}

export async function createCompletedWorkout(
	client: SupabaseClient,
	args: CompletedWorkoutInput & {
		athleteId: string;
		clubId: string;
		generateEmbedding?: boolean;
	},
): Promise<WorkoutRow> {
	const strengthRawData =
		prepareStrengthSessionForCompleted(args) ??
		(args.rawData ? (normalizeStrengthSession(args.rawData) ?? args.rawData) : null);
	const embedding = args.generateEmbedding ? await maybeCreateWorkoutEmbedding(args) : undefined;

	const { data, error } = await client
		.from("workouts")
		.insert({
			athlete_id: args.athleteId,
			club_id: args.clubId,
			activity_type: args.activityType,
			source: "MANUAL",
			started_at: args.startedAt,
			duration_s: args.durationSec ?? null,
			distance_m: args.distanceM ?? null,
			avg_hr: args.avgHr ?? null,
			max_hr: null,
			avg_pace_s_km: null,
			avg_power_w: null,
			calories: null,
			tss: args.tss ?? null,
			raw_data: strengthRawData,
			notes: args.notes ?? null,
			embedding: embedding,
		})
		.select("id, activity_type, started_at, raw_data")
		.single();

	if (error) {
		throw new Error(`Failed to create workout: ${error.message}`);
	}

	if (args.plannedWorkoutId) {
		const { error: linkError } = await client
			.from("planned_workouts")
			.update({
				status: "completed",
				workout_id: data.id,
				session_data: strengthRawData ?? undefined,
			})
			.eq("id", args.plannedWorkoutId)
			.eq("athlete_id", args.athleteId);

		if (linkError) {
			throw new Error(`Failed to link planned workout: ${linkError.message}`);
		}
	}

	return data;
}

export async function updateCompletedWorkout(
	client: SupabaseClient,
	workoutId: string,
	athleteId: string,
	updates: CompletedWorkoutUpdate,
): Promise<WorkoutRow> {
	const nextRawData =
		updates.strengthSession ??
		(updates.rawData ? (normalizeStrengthSession(updates.rawData) ?? updates.rawData) : undefined);

	const { data, error } = await client
		.from("workouts")
		.update({
			avg_hr: updates.avgHr ?? undefined,
			tss: updates.tss ?? undefined,
			notes: updates.notes ?? undefined,
			raw_data: nextRawData,
		})
		.eq("id", workoutId)
		.eq("athlete_id", athleteId)
		.select("id, activity_type, started_at, raw_data")
		.single();

	if (error) {
		throw new Error(`Failed to update workout: ${error.message}`);
	}

	return data;
}

export async function createPlannedWorkout(
	client: SupabaseClient,
	args: PlannedWorkoutInput & { athleteId: string; clubId: string },
): Promise<PlannedWorkoutRow> {
	const { data, error } = await client
		.from("planned_workouts")
		.insert({
			athlete_id: args.athleteId,
			club_id: args.clubId,
			plan_id: args.planId ?? null,
			planned_date: args.plannedDate,
			planned_time: args.plannedTime ?? null,
			activity_type: args.activityType,
			title: args.title,
			description: args.description ?? null,
			duration_min: args.durationMin ?? null,
			distance_km: args.distanceKm ?? null,
			target_tss: args.targetTss ?? null,
			target_rpe: args.targetRpe ?? null,
			intensity: args.intensity ?? null,
			session_data: prepareStrengthSessionForPlanned(args) ?? {},
			status: args.status ?? "planned",
			sort_order: args.sortOrder ?? 0,
			notes: args.notes ?? null,
			coach_notes: args.coachNotes ?? null,
			source: args.source ?? "MANUAL",
		})
		.select("*")
		.single();

	if (error) {
		throw new Error(`Failed to create planned workout: ${error.message}`);
	}

	return data;
}

export async function createDraftSession(
	client: SupabaseClient,
	args: PlannedWorkoutInput & { athleteId: string; clubId: string },
): Promise<PlannedWorkoutRow> {
	return createPlannedWorkout(client, {
		...args,
		status: "in_progress",
		source: args.source ?? "MANUAL",
	});
}

export async function updateDraftSession(
	client: SupabaseClient,
	id: string,
	athleteId: string,
	updates: PlannedWorkoutUpdate,
): Promise<PlannedWorkoutRow> {
	return updatePlannedWorkout(client, id, athleteId, updates);
}

export async function updatePlannedWorkout(
	client: SupabaseClient,
	id: string,
	athleteId: string,
	updates: PlannedWorkoutUpdate,
): Promise<PlannedWorkoutRow> {
	const updateData: Record<string, unknown> = {};
	if (updates.plannedDate !== undefined) updateData.planned_date = updates.plannedDate;
	if (updates.plannedTime !== undefined) updateData.planned_time = updates.plannedTime;
	if (updates.activityType !== undefined) updateData.activity_type = updates.activityType;
	if (updates.title !== undefined) updateData.title = updates.title;
	if (updates.description !== undefined) updateData.description = updates.description;
	if (updates.durationMin !== undefined) updateData.duration_min = updates.durationMin;
	if (updates.distanceKm !== undefined) updateData.distance_km = updates.distanceKm;
	if (updates.targetTss !== undefined) updateData.target_tss = updates.targetTss;
	if (updates.targetRpe !== undefined) updateData.target_rpe = updates.targetRpe;
	if (updates.intensity !== undefined) updateData.intensity = updates.intensity;
	if (updates.sessionData !== undefined) {
		updateData.session_data = prepareStrengthSessionForPlanned(updates) ?? updates.sessionData;
	}
	if (updates.status !== undefined) updateData.status = updates.status;
	if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;
	if (updates.notes !== undefined) updateData.notes = updates.notes;
	if (updates.coachNotes !== undefined) updateData.coach_notes = updates.coachNotes;

	const { data, error } = await client
		.from("planned_workouts")
		.update(updateData)
		.eq("id", id)
		.eq("athlete_id", athleteId)
		.select("*")
		.single();

	if (error) {
		throw new Error(`Failed to update planned workout: ${error.message}`);
	}

	return data;
}

export async function completeDraftSession(
	client: SupabaseClient,
	id: string,
	args: CompletedWorkoutInput & { athleteId: string; clubId: string },
): Promise<{ workout: WorkoutRow; plannedWorkout: PlannedWorkoutRow | null }> {
	const workout = await createCompletedWorkout(client, {
		...args,
		plannedWorkoutId: id,
	});

	const { data, error } = await client
		.from("planned_workouts")
		.select("*")
		.eq("id", id)
		.eq("athlete_id", args.athleteId)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to fetch completed draft: ${error.message}`);
	}

	return {
		workout,
		plannedWorkout: data,
	};
}

export async function scheduleSessionsBatch(
	client: SupabaseClient,
	args: {
		athleteId: string;
		clubId: string;
		workouts: PlannedWorkoutInput[];
	},
): Promise<PlannedWorkoutRow[]> {
	const rows = args.workouts.map((workout) => ({
		athlete_id: args.athleteId,
		club_id: args.clubId,
		plan_id: workout.planId ?? null,
		planned_date: workout.plannedDate,
		planned_time: workout.plannedTime ?? null,
		activity_type: workout.activityType,
		title: workout.title,
		description: workout.description ?? null,
		duration_min: workout.durationMin ?? null,
		distance_km: workout.distanceKm ?? null,
		target_tss: workout.targetTss ?? null,
		target_rpe: workout.targetRpe ?? null,
		intensity: workout.intensity ?? null,
		session_data: prepareStrengthSessionForPlanned(workout) ?? {},
		status: workout.status ?? "planned",
		sort_order: workout.sortOrder ?? 0,
		notes: workout.notes ?? null,
		coach_notes: workout.coachNotes ?? null,
		source: workout.source ?? "MANUAL",
	}));

	const { data, error } = await client.from("planned_workouts").insert(rows).select("*");
	if (error) {
		throw new Error(`Failed to batch schedule workouts: ${error.message}`);
	}

	return data ?? [];
}

export function buildStrengthSessionFromLegacyInput(input: {
	startedAt?: string;
	durationSec?: number;
	plannedDate?: string;
	plannedTime?: string;
	mode: StrengthSessionV1["mode"];
	status: StrengthSessionV1["status"];
	source?: StrengthSessionV1["source"];
	focus?: string;
	sessionNotes?: string;
	exercises: Array<{
		name: string;
		notes?: string;
		groupId?: number;
		groupType?: StrengthSessionV1["exercises"][number]["groupType"];
		sets: Array<{
			reps?: number;
			weightKg?: number;
			rpe?: number;
			rir?: number;
			tempo?: string;
			setType?: StrengthSessionV1["exercises"][number]["sets"][number]["setType"];
		}>;
	}>;
}): StrengthSessionV1 {
	return {
		schemaVersion: 1,
		activityType: "STRENGTH",
		mode: input.mode,
		status: input.status,
		source: input.source ?? "MANUAL",
		focus: input.focus,
		startedAt: input.startedAt,
		endedAt:
			input.startedAt && input.durationSec
				? new Date(new Date(input.startedAt).getTime() + input.durationSec * 1000).toISOString()
				: undefined,
		plannedDate: input.plannedDate,
		plannedTime: input.plannedTime,
		durationSec: input.durationSec,
		sessionNotes: input.sessionNotes,
		exercises: input.exercises.map((exercise, exerciseIndex) => {
			const catalogItem = findStrengthExerciseCatalogItem(exercise.name);
			return {
				id: `exercise-${exerciseIndex + 1}`,
				catalogId: catalogItem?.id,
				displayName: catalogItem?.displayName ?? exercise.name,
				isCustom: !catalogItem,
				equipment: catalogItem?.equipment[0] ?? "other",
				movementPattern: catalogItem?.movementPattern ?? "other",
				primaryMuscleGroups: catalogItem?.primaryMuscleGroups ?? ["full"],
				notes: exercise.notes,
				groupId: exercise.groupId,
				groupType: exercise.groupType,
				sets: exercise.sets.map((set, setIndex) => ({
					id: `set-${setIndex + 1}`,
					order: setIndex + 1,
					setType: set.setType ?? "working",
					completed: input.status === "completed",
					reps: set.reps,
					weightKg: set.weightKg,
					rpe: set.rpe,
					rir: set.rir,
					tempo: set.tempo,
				})),
			};
		}),
	};
}
