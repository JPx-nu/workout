// ============================================================
// Strength Training Types
// Structured data for 'raw_data' column in workouts table
// ============================================================

export type MuscleGroup =
	| "chest"
	| "back"
	| "legs"
	| "shoulders"
	| "arms"
	| "core"
	| "full";

export interface StrengthSet {
	id: string;
	weightKg: number;
	reps: number;
	rpe?: number; // 1-10
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
	focus: string; // e.g., "Legs & Core"
	exercises: StrengthExercise[];
}
