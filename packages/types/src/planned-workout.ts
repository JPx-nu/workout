/**
 * Planned Workout Types — Zod schemas and TypeScript types
 * for workout planning, scheduling, and AI plan generation.
 *
 * Uses Zod 4 APIs (consistent with the rest of @triathlon/types).
 */

import { z } from "zod/v4";

// ── Enums ──────────────────────────────────────────────────────

export const ActivityType = z.enum(["SWIM", "BIKE", "RUN", "STRENGTH", "YOGA", "OTHER"]);

export const Intensity = z.enum(["RECOVERY", "EASY", "MODERATE", "HARD", "MAX"]);

export const PlannedWorkoutStatus = z.enum([
	"planned",
	"completed",
	"skipped",
	"modified",
	"in_progress",
	"cancelled",
]);

export const WorkoutSource = z.enum(["AI", "COACH", "MANUAL"]);

// ── Session Data Schemas ───────────────────────────────────────

export const ExerciseSet = z.object({
	setNumber: z.number().int().min(1),
	reps: z.number().int().min(1).optional(),
	weight: z.number().min(0).optional(),
	durationSec: z.number().int().min(0).optional(),
	distanceM: z.number().min(0).optional(),
	rpe: z.number().min(1).max(10).optional(),
	rest: z.number().int().min(0).optional(),
	notes: z.string().optional(),
});
export type ExerciseSet = z.infer<typeof ExerciseSet>;

export const Exercise = z.object({
	name: z.string().min(1),
	sets: z.array(ExerciseSet).min(1),
	notes: z.string().optional(),
	supersetWith: z.string().optional(),
});
export type Exercise = z.infer<typeof Exercise>;

export const Interval = z.object({
	name: z.string(),
	durationMin: z.number().optional(),
	distanceKm: z.number().optional(),
	targetPace: z.string().optional(),
	targetHrZone: z.number().int().min(1).max(5).optional(),
	targetRpe: z.number().min(1).max(10).optional(),
	repeat: z.number().int().min(1).default(1),
	notes: z.string().optional(),
});
export type Interval = z.infer<typeof Interval>;

export const SessionData = z.object({
	exercises: z.array(Exercise).optional(),
	intervals: z.array(Interval).optional(),
	warmupMin: z.number().optional(),
	cooldownMin: z.number().optional(),
	notes: z.string().optional(),
});
export type SessionData = z.infer<typeof SessionData>;

// ── Planned Workout Schema ─────────────────────────────────────

export const PlannedWorkout = z.object({
	id: z.uuid(),
	athleteId: z.uuid(),
	clubId: z.uuid(),
	planId: z.uuid().nullable().optional(),
	workoutId: z.uuid().nullable().optional(),

	// Scheduling
	plannedDate: z.string(),
	plannedTime: z.string().nullable().optional(),

	// Session definition
	activityType: ActivityType,
	title: z.string().min(1),
	description: z.string().nullable().optional(),
	durationMin: z.number().int().nullable().optional(),
	distanceKm: z.number().nullable().optional(),
	targetTss: z.number().nullable().optional(),
	targetRpe: z.number().int().min(1).max(10).nullable().optional(),
	intensity: Intensity.nullable().optional(),

	// Structured data
	sessionData: SessionData.optional().default({}),

	// Status
	status: PlannedWorkoutStatus.default("planned"),

	// Metadata
	sortOrder: z.number().int().default(0),
	notes: z.string().nullable().optional(),
	coachNotes: z.string().nullable().optional(),
	source: WorkoutSource.default("MANUAL"),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
});
export type PlannedWorkout = z.infer<typeof PlannedWorkout>;

// ── Create / Update DTOs ───────────────────────────────────────

export const CreatePlannedWorkout = PlannedWorkout.omit({
	id: true,
	athleteId: true,
	clubId: true,
	workoutId: true,
	createdAt: true,
	updatedAt: true,
});
export type CreatePlannedWorkout = z.infer<typeof CreatePlannedWorkout>;

export const UpdatePlannedWorkout = CreatePlannedWorkout.partial();
export type UpdatePlannedWorkout = z.infer<typeof UpdatePlannedWorkout>;

// ── AI Plan Generation Schemas ─────────────────────────────────

export const AiPlannedSession = z.object({
	dayOffset: z.number().int().min(0),
	activityType: ActivityType,
	title: z.string(),
	description: z.string(),
	durationMin: z.number().int().min(5),
	intensity: Intensity,
	targetRpe: z.number().int().min(1).max(10).optional(),
	distanceKm: z.number().optional(),
	sessionData: SessionData.optional(),
});
export type AiPlannedSession = z.infer<typeof AiPlannedSession>;

export const AiWeeklyBlock = z.object({
	weekNumber: z.number().int().min(1),
	theme: z.string(),
	sessions: z.array(AiPlannedSession).min(1),
});
export type AiWeeklyBlock = z.infer<typeof AiWeeklyBlock>;

export const AiTrainingPlanOutput = z.object({
	name: z.string(),
	durationWeeks: z.number().int().min(1).max(52),
	goal: z.string(),
	weeks: z.array(AiWeeklyBlock).min(1),
});
export type AiTrainingPlanOutput = z.infer<typeof AiTrainingPlanOutput>;

// ── DB <-> camelCase converters ────────────────────────────────

export function dbRowToPlannedWorkout(row: Record<string, unknown>): PlannedWorkout {
	return {
		id: row.id as string,
		athleteId: row.athlete_id as string,
		clubId: row.club_id as string,
		planId: (row.plan_id as string) || null,
		workoutId: (row.workout_id as string) || null,
		plannedDate: row.planned_date as string,
		plannedTime: (row.planned_time as string) || null,
		activityType: row.activity_type as PlannedWorkout["activityType"],
		title: row.title as string,
		description: (row.description as string) || null,
		durationMin: (row.duration_min as number) || null,
		distanceKm: (row.distance_km as number) || null,
		targetTss: (row.target_tss as number) || null,
		targetRpe: (row.target_rpe as number) || null,
		intensity: (row.intensity as PlannedWorkout["intensity"]) || null,
		sessionData: (row.session_data as SessionData) || {},
		status: (row.status as PlannedWorkout["status"]) || "planned",
		sortOrder: (row.sort_order as number) || 0,
		notes: (row.notes as string) || null,
		coachNotes: (row.coach_notes as string) || null,
		source: (row.source as PlannedWorkout["source"]) || "MANUAL",
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string,
	};
}

export function plannedWorkoutToDbRow(pw: Partial<CreatePlannedWorkout>) {
	const row: Record<string, unknown> = {};
	if (pw.plannedDate !== undefined) row.planned_date = pw.plannedDate;
	if (pw.plannedTime !== undefined) row.planned_time = pw.plannedTime;
	if (pw.activityType !== undefined) row.activity_type = pw.activityType;
	if (pw.title !== undefined) row.title = pw.title;
	if (pw.description !== undefined) row.description = pw.description;
	if (pw.durationMin !== undefined) row.duration_min = pw.durationMin;
	if (pw.distanceKm !== undefined) row.distance_km = pw.distanceKm;
	if (pw.targetTss !== undefined) row.target_tss = pw.targetTss;
	if (pw.targetRpe !== undefined) row.target_rpe = pw.targetRpe;
	if (pw.intensity !== undefined) row.intensity = pw.intensity;
	if (pw.sessionData !== undefined) row.session_data = pw.sessionData;
	if (pw.status !== undefined) row.status = pw.status;
	if (pw.sortOrder !== undefined) row.sort_order = pw.sortOrder;
	if (pw.notes !== undefined) row.notes = pw.notes;
	if (pw.coachNotes !== undefined) row.coach_notes = pw.coachNotes;
	if (pw.source !== undefined) row.source = pw.source;
	if (pw.planId !== undefined) row.plan_id = pw.planId;
	return row;
}

// ── Display constants ──────────────────────────────────────────

export const ACTIVITY_COLORS = {
	SWIM: "#3b82f6",
	BIKE: "#22c55e",
	RUN: "#f97316",
	STRENGTH: "#a855f7",
	YOGA: "#ec4899",
	OTHER: "#6b7280",
} as const;

export const ACTIVITY_ICONS = {
	SWIM: "🏊",
	BIKE: "🚴",
	RUN: "🏃",
	STRENGTH: "🏋️",
	YOGA: "🧘",
	OTHER: "⚡",
} as const;

export const INTENSITY_COLORS = {
	RECOVERY: "#86efac",
	EASY: "#4ade80",
	MODERATE: "#facc15",
	HARD: "#f97316",
	MAX: "#ef4444",
} as const;
