// ============================================================
// @triathlon/core — Shared cross-platform business logic
// ============================================================

export type {
	ExerciseData,
	ExerciseSummary,
	SetData,
	StrengthMetrics,
	StrengthWorkoutLike,
} from "./strength/index";
// Strength training
export {
	computeAverageRPE,
	computeSessionVolume,
	computeStrengthMetrics,
	computeVolume,
	estimate1RM,
	findTopSet,
	summarizeStrengthWorkout,
} from "./strength/index";
// Date utilities
export {
	daysUntil,
	getWeekStart,
	lookbackDate,
	progressPercent,
	toIsoDate,
} from "./utils/dates";
// Formatting utilities
export {
	formatDuration,
	formatPace,
	mToKm,
	secToMin,
} from "./utils/formatters";
export type {
	DailyLogRow,
	MappedDailyLog,
	MappedPlannedWorkout,
	MappedWorkout,
	PlannedWorkoutRow,
	WorkoutRow,
} from "./utils/mappers";
// Data mappers
export {
	mapDailyLogRow,
	mapPlannedWorkoutRow,
	mapWorkoutRow,
} from "./utils/mappers";
export type {
	ActivityStats,
	ChartDataPoint,
	FatigueLevel,
	HealthSnapshot,
	MuscleFatigue,
	WeeklyStats,
	WorkoutLike,
} from "./utils/stats";
// Statistics & health
export {
	computeChartData,
	computeReadinessScore,
	computeWeeklyStats,
	DEFAULT_HEALTH_SNAPSHOT,
	DEFAULT_MUSCLE_GROUPS,
	mergeInjuriesToMuscleGroups,
	severityToFatigueLevel,
} from "./utils/stats";
