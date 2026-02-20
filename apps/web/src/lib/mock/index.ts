// ============================================================
// Central barrel export for types and constants
//
// All hooks now query Supabase directly.
// These files only export types + a few static constants.
// ============================================================

export { type Conversation, type Message, suggestedPrompts } from "./coach";
export {
	type DailyLog,
	type FatigueLevel,
	type HealthSnapshot,
	type MuscleFatigue,
	mockFatigueData,
} from "./health";
export type { AppProfile as Profile } from "@triathlon/types";
export type {
	TrainingPlan,
	TrainingSession,
	UpcomingEvent,
} from "./training";
export type { ChartDataPoint, WeeklyStats, Workout } from "./workouts";
