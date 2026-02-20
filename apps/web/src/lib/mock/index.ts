// ============================================================
// Central barrel export for types and constants
//
// All hooks now query Supabase directly.
// These files only export types + a few static constants.
// ============================================================

export { type Profile } from './profile';
export {
    type Workout, type WeeklyStats, type ChartDataPoint,
} from './workouts';
export {
    type TrainingPlan, type TrainingSession, type UpcomingEvent,
} from './training';
export {
    suggestedPrompts,
    type Message, type Conversation,
} from './coach';
export {
    mockFatigueData,
    type MuscleFatigue, type DailyLog, type HealthSnapshot, type FatigueLevel,
} from './health';
