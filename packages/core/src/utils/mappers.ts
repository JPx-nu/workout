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

export interface PlannedWorkoutRow {
	id: string;
	athlete_id: string;
	club_id: string;
	plan_id: string | null;
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
	workout_id: string | null;
	created_at: string;
	updated_at: string;
}

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
		id: row.id,
		athleteId: row.athlete_id,
		planId: row.plan_id,
		plannedDate: row.planned_date,
		plannedTime: row.planned_time,
		activityType: row.activity_type,
		title: row.title,
		description: row.description,
		durationMin: row.duration_min,
		distanceKm: row.distance_km,
		targetTss: row.target_tss,
		targetRpe: row.target_rpe,
		intensity: row.intensity,
		sessionData: row.session_data || {},
		status: row.status,
		sortOrder: row.sort_order,
		notes: row.notes,
		coachNotes: row.coach_notes,
		source: row.source,
		workoutId: row.workout_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}
