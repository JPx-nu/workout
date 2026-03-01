// ============================================================
// Data Mappers
// Snake_case DB rows → camelCase frontend types.
// Single source of truth for all row transformations.
// ============================================================

import type { ActivityType, DataSource } from "@triathlon/types";

// ── Workout Mapper ────────────────────────────────────────────

export type WorkoutRow = {
	id: string;
	athlete_id: string;
	club_id: string | null;
	activity_type: string;
	source: string;
	started_at: string;
	duration_s: number;
	distance_m: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	avg_pace_s_km: number | null;
	avg_power_w: number | null;
	calories: number | null;
	tss: number | null;
	notes: string | null;
	raw_data?: Record<string, unknown>;
};

export type MappedWorkout = {
	id: string;
	athleteId: string;
	clubId: string;
	activityType: ActivityType;
	source: DataSource;
	startedAt: string;
	durationSec: number;
	distanceM: number | null;
	avgHr: number | null;
	maxHr: number | null;
	avgPaceSecKm: number | null;
	avgPowerW: number | null;
	calories: number | null;
	tss: number | null;
	notes: string | null;
	rawData?: Record<string, unknown>;
};

export function mapWorkoutRow(row: WorkoutRow): MappedWorkout {
	return {
		id: row.id,
		athleteId: row.athlete_id,
		clubId: row.club_id ?? "",
		activityType: row.activity_type as ActivityType,
		source: row.source as DataSource,
		startedAt: row.started_at,
		durationSec: row.duration_s,
		distanceM: row.distance_m,
		avgHr: row.avg_hr,
		maxHr: row.max_hr,
		avgPaceSecKm: row.avg_pace_s_km,
		avgPowerW: row.avg_power_w,
		calories: row.calories,
		tss: row.tss,
		notes: row.notes,
		rawData: row.raw_data ?? undefined,
	};
}

// ── Daily Log Mapper ──────────────────────────────────────────

export type DailyLogRow = {
	id: string;
	log_date: string;
	sleep_hours: number | null;
	sleep_quality: number | null;
	rpe: number | null;
	mood: number | null;
	hrv: number | null;
	resting_hr: number | null;
	weight_kg: number | null;
	notes: string | null;
};

export type MappedDailyLog = {
	id: string;
	date: string;
	sleepHours: number;
	sleepQuality: number;
	rpe: number;
	mood: number;
	hrv: number;
	restingHr: number;
	weightKg: number;
	notes: string | null;
};

export function mapDailyLogRow(row: DailyLogRow): MappedDailyLog {
	return {
		id: row.id,
		date: row.log_date,
		sleepHours: row.sleep_hours ?? 0,
		sleepQuality: row.sleep_quality ?? 5,
		rpe: row.rpe ?? 5,
		mood: row.mood ?? 5,
		hrv: row.hrv ?? 0,
		restingHr: row.resting_hr ?? 0,
		weightKg: row.weight_kg ?? 0,
		notes: row.notes ?? null,
	};
}

// ── Planned Workout Mapper ────────────────────────────────────

export type PlannedWorkoutRow = Record<string, unknown>;

export type MappedPlannedWorkout = {
	id: string;
	athleteId: string;
	planId: string | null;
	plannedDate: string;
	plannedTime: string | null;
	activityType: string;
	title: string;
	description: string | null;
	durationMin: number | null;
	distanceKm: number | null;
	targetTss: number | null;
	targetRpe: number | null;
	intensity: string | null;
	sessionData: Record<string, unknown>;
	status: string;
	sortOrder: number;
	notes: string | null;
	coachNotes: string | null;
	source: string;
	workoutId: string | null;
	createdAt: string;
	updatedAt: string;
};

export function mapPlannedWorkoutRow(row: PlannedWorkoutRow): MappedPlannedWorkout {
	return {
		id: row.id as string,
		athleteId: row.athlete_id as string,
		planId: row.plan_id as string | null,
		plannedDate: row.planned_date as string,
		plannedTime: row.planned_time as string | null,
		activityType: row.activity_type as string,
		title: row.title as string,
		description: row.description as string | null,
		durationMin: row.duration_min as number | null,
		distanceKm: row.distance_km as number | null,
		targetTss: row.target_tss as number | null,
		targetRpe: row.target_rpe as number | null,
		intensity: row.intensity as string | null,
		sessionData: (row.session_data as Record<string, unknown>) || {},
		status: row.status as string,
		sortOrder: row.sort_order as number,
		notes: row.notes as string | null,
		coachNotes: row.coach_notes as string | null,
		source: row.source as string,
		workoutId: row.workout_id as string | null,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}
