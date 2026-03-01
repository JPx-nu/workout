// ── Strength Training Types ─────────────────────────────────
// Frontend-friendly types for strength workout data.
// Used by UI components and the computeStrengthMetrics function.
// ─────────────────────────────────────────────────────────────

export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full";

export interface StrengthSet {
	id: string;
	weightKg: number;
	reps: number;
	rpe?: number;
	type: "warmup" | "working" | "failure" | "drop";
}

export interface StrengthExercise {
	id: string;
	name: string;
	muscleGroup: MuscleGroup;
	sets: StrengthSet[];
	notes?: string;
}

export interface StrengthSessionData {
	focus: string;
	exercises: StrengthExercise[];
}
