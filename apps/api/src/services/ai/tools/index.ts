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
        // Write tools (require user confirmation via prompt)
        createLogWorkoutTool(client, userId, clubId),
        createUpdateSorenessTool(client, userId, clubId),
        createModifyTrainingPlanTool(client, userId),
    ];
}
