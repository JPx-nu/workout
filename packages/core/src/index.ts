// ============================================================
// @triathlon/core — Shared cross-platform business logic
// ============================================================

export type {
	ExerciseData,
	ExerciseSummary,
	SetData,
} from "./strength/index.js";
// Strength training
export {
	computeAverageRPE,
	computeSessionVolume,
	computeVolume,
	estimate1RM,
	findTopSet,
	summarizeStrengthWorkout,
} from "./strength/index.js";
// Date utilities
export {
	daysUntil,
	getWeekStart,
	lookbackDate,
	progressPercent,
	toIsoDate,
} from "./utils/dates.js";
// Formatting utilities
export {
	formatDuration,
	formatPace,
	mToKm,
	secToMin,
} from "./utils/formatters.js";
export type {
	DailyLogRow,
	MappedDailyLog,
	MappedPlannedWorkout,
	MappedWorkout,
	PlannedWorkoutRow,
	WorkoutRow,
} from "./utils/mappers.js";
// Data mappers
export {
	mapDailyLogRow,
	mapPlannedWorkoutRow,
	mapWorkoutRow,
} from "./utils/mappers.js";
export type {
	ActivityStats,
	ChartDataPoint,
	FatigueLevel,
	HealthSnapshot,
	MuscleFatigue,
	WeeklyStats,
	WorkoutLike,
} from "./utils/stats.js";
// Statistics & health
export {
	computeChartData,
	computeReadinessScore,
	computeWeeklyStats,
	DEFAULT_HEALTH_SNAPSHOT,
	DEFAULT_MUSCLE_GROUPS,
	mergeInjuriesToMuscleGroups,
	severityToFatigueLevel,
} from "./utils/stats.js";
