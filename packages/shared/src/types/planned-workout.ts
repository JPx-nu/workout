/**
 * Shared types and Zod schemas for planned workouts.
 * Used by both the API (AI tools + REST endpoints) and the web UI.
 */
import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────

export const ActivityType = z.enum([
    'SWIM', 'BIKE', 'RUN', 'STRENGTH', 'YOGA', 'OTHER',
]);
export type ActivityType = z.infer<typeof ActivityType>;

export const Intensity = z.enum([
    'RECOVERY', 'EASY', 'MODERATE', 'HARD', 'MAX',
]);
export type Intensity = z.infer<typeof Intensity>;

export const PlannedWorkoutStatus = z.enum([
    'planned', 'completed', 'skipped', 'modified', 'in_progress',
]);
export type PlannedWorkoutStatus = z.infer<typeof PlannedWorkoutStatus>;

export const WorkoutSource = z.enum(['AI', 'COACH', 'MANUAL']);
export type WorkoutSource = z.infer<typeof WorkoutSource>;

// ── Session Data Schemas ───────────────────────────────────────

export const exerciseSetSchema = z.object({
    setNumber: z.number().int().min(1),
    reps: z.number().int().min(1).optional(),
    weight: z.number().min(0).optional(),
    durationSec: z.number().int().min(0).optional(),
    distanceM: z.number().min(0).optional(),
    rpe: z.number().min(1).max(10).optional(),
    rest: z.number().int().min(0).optional().describe('Rest in seconds after this set'),
    notes: z.string().optional(),
});
export type ExerciseSet = z.infer<typeof exerciseSetSchema>;

export const exerciseSchema = z.object({
    name: z.string().min(1),
    sets: z.array(exerciseSetSchema).min(1),
    notes: z.string().optional(),
    supersetWith: z.string().optional().describe('Name of exercise this is supersetted with'),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const intervalSchema = z.object({
    name: z.string().describe('e.g. "Warm-up", "Tempo", "Recovery"'),
    durationMin: z.number().optional(),
    distanceKm: z.number().optional(),
    targetPace: z.string().optional().describe('e.g. "5:30/km"'),
    targetHrZone: z.number().int().min(1).max(5).optional(),
    targetRpe: z.number().min(1).max(10).optional(),
    repeat: z.number().int().min(1).default(1),
    notes: z.string().optional(),
});
export type Interval = z.infer<typeof intervalSchema>;

export const sessionDataSchema = z.object({
    exercises: z.array(exerciseSchema).optional(),
    intervals: z.array(intervalSchema).optional(),
    warmupMin: z.number().optional(),
    cooldownMin: z.number().optional(),
    notes: z.string().optional(),
});
export type SessionData = z.infer<typeof sessionDataSchema>;

// ── Planned Workout Schema ─────────────────────────────────────

export const plannedWorkoutSchema = z.object({
    id: z.string().uuid(),
    athleteId: z.string().uuid(),
    clubId: z.string().uuid(),
    planId: z.string().uuid().nullable().optional(),
    workoutId: z.string().uuid().nullable().optional(),

    // Scheduling
    plannedDate: z.string().describe('ISO date string YYYY-MM-DD'),
    plannedTime: z.string().nullable().optional().describe('HH:MM:SS'),

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
    sessionData: sessionDataSchema.optional().default({}),

    // Status
    status: PlannedWorkoutStatus.default('planned'),

    // Metadata
    sortOrder: z.number().int().default(0),
    notes: z.string().nullable().optional(),
    coachNotes: z.string().nullable().optional(),
    source: WorkoutSource.default('MANUAL'),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});
export type PlannedWorkout = z.infer<typeof plannedWorkoutSchema>;

// ── Create / Update DTOs ───────────────────────────────────────

export const createPlannedWorkoutSchema = plannedWorkoutSchema.omit({
    id: true,
    athleteId: true,
    clubId: true,
    workoutId: true,
    createdAt: true,
    updatedAt: true,
});
export type CreatePlannedWorkout = z.infer<typeof createPlannedWorkoutSchema>;

export const updatePlannedWorkoutSchema = createPlannedWorkoutSchema.partial();
export type UpdatePlannedWorkout = z.infer<typeof updatePlannedWorkoutSchema>;

// ── AI Plan Generation Schema ──────────────────────────────────

export const aiPlannedSessionSchema = z.object({
    dayOffset: z.number().int().min(0).describe('Day offset from plan start (0 = first day)'),
    activityType: ActivityType,
    title: z.string().describe('Session title, e.g. "Tempo Run" or "Upper Body Strength"'),
    description: z.string().describe('Detailed session instructions for the athlete'),
    durationMin: z.number().int().min(5),
    intensity: Intensity,
    targetRpe: z.number().int().min(1).max(10).optional(),
    distanceKm: z.number().optional(),
    sessionData: sessionDataSchema.optional(),
});
export type AiPlannedSession = z.infer<typeof aiPlannedSessionSchema>;

export const aiWeeklyBlockSchema = z.object({
    weekNumber: z.number().int().min(1),
    theme: z.string().describe('Week theme, e.g. "Build Phase 1" or "Recovery Week"'),
    sessions: z.array(aiPlannedSessionSchema).min(1),
});
export type AiWeeklyBlock = z.infer<typeof aiWeeklyBlockSchema>;

export const aiTrainingPlanOutputSchema = z.object({
    name: z.string().describe('Plan name, e.g. "Half Marathon 12-Week Plan"'),
    durationWeeks: z.number().int().min(1).max(52),
    goal: z.string().describe('Primary training goal'),
    weeks: z.array(aiWeeklyBlockSchema).min(1),
});
export type AiTrainingPlanOutput = z.infer<typeof aiTrainingPlanOutputSchema>;

// ── Utility: DB row → camelCase ────────────────────────────────

export function dbRowToPlannedWorkout(row: Record<string, unknown>): PlannedWorkout {
    return {
        id: row.id as string,
        athleteId: row.athlete_id as string,
        clubId: row.club_id as string,
        planId: (row.plan_id as string) || null,
        workoutId: (row.workout_id as string) || null,
        plannedDate: row.planned_date as string,
        plannedTime: (row.planned_time as string) || null,
        activityType: row.activity_type as ActivityType,
        title: row.title as string,
        description: (row.description as string) || null,
        durationMin: (row.duration_min as number) || null,
        distanceKm: (row.distance_km as number) || null,
        targetTss: (row.target_tss as number) || null,
        targetRpe: (row.target_rpe as number) || null,
        intensity: (row.intensity as Intensity) || null,
        sessionData: (row.session_data as SessionData) || {},
        status: (row.status as PlannedWorkoutStatus) || 'planned',
        sortOrder: (row.sort_order as number) || 0,
        notes: (row.notes as string) || null,
        coachNotes: (row.coach_notes as string) || null,
        source: (row.source as WorkoutSource) || 'MANUAL',
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

// ── Utility: camelCase → DB row ────────────────────────────────

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

// ── Calendar display helpers ───────────────────────────────────

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
    SWIM: '#3b82f6',     // blue-500
    BIKE: '#22c55e',     // green-500
    RUN: '#f97316',      // orange-500
    STRENGTH: '#a855f7', // purple-500
    YOGA: '#ec4899',     // pink-500
    OTHER: '#6b7280',    // gray-500
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
    SWIM: '🏊',
    BIKE: '🚴',
    RUN: '🏃',
    STRENGTH: '🏋️',
    YOGA: '🧘',
    OTHER: '⚡',
};

export const INTENSITY_COLORS: Record<Intensity, string> = {
    RECOVERY: '#86efac', // green-300
    EASY: '#4ade80',     // green-400
    MODERATE: '#facc15',  // yellow-400
    HARD: '#f97316',     // orange-500
    MAX: '#ef4444',      // red-500
};
