// ============================================================
// Tool Barrel Export
// Creates all tools bound to a specific user context
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { createGetAthleteProfileTool } from './get-athlete-profile.js';
import { createGetWorkoutHistoryTool } from './get-workout-history.js';
import { createGetHealthMetricsTool } from './get-health-metrics.js';
import { createGetTrainingPlanTool } from './get-training-plan.js';
import { createGetProgressReportTool } from './get-progress-report.js';
import { createLogWorkoutTool } from './log-workout.js';
import { createUpdateSorenessTool } from './update-soreness.js';
import { createModifyTrainingPlanTool } from './modify-training-plan.js';
import { createGenerateWorkoutPlanTool } from './generate-workout-plan.js';
import { createScheduleWorkoutTool } from './schedule-workout.js';
import { createMatchDocumentsTool } from './match-documents.js';
import { createTraverseGraphTool } from './traverse-graph.js';
import { createSearchWorkoutsTool } from './search-workouts.js';
import { createSaveMemoryTool } from './save-memory.js';
import { createAnalyzeBiometricTrendsTool } from './analyze-biometric-trends.js';
import { createAnalyzeWorkoutsTool } from './analyze-workouts.js';
import { createPredictInjuryRiskTool } from './predict-injury-risk.js';
import { createGetSquadLeaderboardTool } from './get-squad-leaderboard.js';
import { createPassBatonTool } from './pass-baton.js';

/**
 * Creates all agent tools bound to a specific user's auth context.
 * Each tool wraps the shared service layer, enabling future
 * exposure via REST/MCP for external agents.
 */
export function createAllTools(client: SupabaseClient, userId: string, clubId: string) {
    return [
        // Read tools
        createGetAthleteProfileTool(client, userId),
        createGetWorkoutHistoryTool(client, userId),
        createGetHealthMetricsTool(client, userId),
        createGetTrainingPlanTool(client, userId),
        createGetProgressReportTool(client, userId),
        // Gamification tools
        createGetSquadLeaderboardTool(client, userId),
        createPassBatonTool(client, userId),
        // Write tools (require user confirmation via prompt)
        createLogWorkoutTool(client, userId, clubId),
        createUpdateSorenessTool(client, userId, clubId),
        createModifyTrainingPlanTool(client, userId),
        // Training plan & scheduling tools
        createGenerateWorkoutPlanTool(client, userId, clubId),
        createScheduleWorkoutTool(client, userId, clubId),
        // GraphRAG & Knowledge Graph tools
        createMatchDocumentsTool(client, clubId),
        createTraverseGraphTool(client, userId),
        createSearchWorkoutsTool(client, userId),
        createSaveMemoryTool(client, userId),
        createAnalyzeBiometricTrendsTool(client, userId),
        createAnalyzeWorkoutsTool(client, userId),
        createPredictInjuryRiskTool(client, userId),
    ];
}

