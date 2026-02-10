// ============================================================
// @mock — Central barrel export for all mock data
//
// MIGRATION STRATEGY:
// Each mock module maps to specific Supabase tables. When you're
// ready to replace a domain with real data:
//   1. Create a hook in src/hooks/ (e.g., useWorkouts)
//   2. Initially import from this mock module
//   3. Swap the hook internals to use Supabase client
//   4. Remove the mock import — the component stays unchanged
//
// See: docs/MOCK_DATA_MIGRATION.md for the full checklist.
// ============================================================

export { mockProfile, type Profile } from './profile';
export {
    mockWorkouts, mockWeeklyStats, mockActivityChartData,
    type Workout, type WeeklyStats, type ChartDataPoint,
} from './workouts';
export {
    mockTrainingPlan, mockUpcomingEvents,
    type TrainingPlan, type TrainingSession, type UpcomingEvent,
} from './training';
export {
    mockConversation, mockConversationList, suggestedPrompts,
    type Message, type Conversation,
} from './coach';
export {
    mockFatigueData, mockDailyLogs, mockHealthSnapshot,
    type MuscleFatigue, type DailyLog, type HealthSnapshot, type FatigueLevel,
} from './health';
