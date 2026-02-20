// ============================================================
// Health & Body Map Types
// ============================================================

export type FatigueLevel = "low" | "moderate" | "high";

export type MuscleFatigue = {
	muscle: string;
	bodyPart: string; // Maps to injuries.body_part in Supabase
	level: number; // 0-100
	status: FatigueLevel;
};

export type DailyLog = {
	id: string;
	date: string;
	sleepHours: number;
	sleepQuality: number; // 1-10
	rpe: number; // 1-10
	mood: number; // 1-10
	hrv: number;
	restingHr: number;
	weightKg: number;
	notes: string | null;
};

export type HealthSnapshot = {
	hrv: number;
	restingHr: number;
	sleepHours: number;
	sleepQuality: number;
	vo2max: number;
	weightKg: number;
	readinessScore: number;
};

// Fallback data used by the 3D body map demo view
export const mockFatigueData: MuscleFatigue[] = [
	{ muscle: "Quadriceps", bodyPart: "quadriceps", level: 85, status: "high" },
	{ muscle: "Hamstrings", bodyPart: "hamstrings", level: 72, status: "high" },
	{ muscle: "Calves", bodyPart: "calves", level: 65, status: "moderate" },
	{ muscle: "Shoulders", bodyPart: "shoulders", level: 40, status: "moderate" },
	{ muscle: "Core", bodyPart: "core", level: 55, status: "moderate" },
	{ muscle: "Glutes", bodyPart: "glutes", level: 70, status: "high" },
	{
		muscle: "Lower Back",
		bodyPart: "lower_back",
		level: 45,
		status: "moderate",
	},
	{ muscle: "Lats", bodyPart: "lats", level: 35, status: "low" },
	{ muscle: "Chest", bodyPart: "chest", level: 30, status: "low" },
	{ muscle: "Biceps", bodyPart: "biceps", level: 42, status: "moderate" },
	{ muscle: "Triceps", bodyPart: "triceps", level: 38, status: "low" },
	{ muscle: "Traps", bodyPart: "traps", level: 48, status: "moderate" },
	{ muscle: "Forearms", bodyPart: "forearms", level: 25, status: "low" },
	{ muscle: "Neck", bodyPart: "neck", level: 20, status: "low" },
	{
		muscle: "Hip Flexors",
		bodyPart: "hip_flexors",
		level: 58,
		status: "moderate",
	},
	{ muscle: "Adductors", bodyPart: "adductors", level: 52, status: "moderate" },
];
