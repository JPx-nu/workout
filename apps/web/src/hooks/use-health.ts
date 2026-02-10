// ============================================================
// @mock — Service hook: useHealth
// STATUS: Using mock data
// SWAP TO: Supabase queries on health_metrics + injuries + daily_logs
// ============================================================

import {
    mockFatigueData, mockDailyLogs, mockHealthSnapshot,
    type MuscleFatigue, type DailyLog, type HealthSnapshot,
} from '@/lib/mock';

/**
 * Returns health data — fatigue levels, daily logs, and current snapshot.
 *
 * @mock Currently returns hardcoded mock data.
 * @real Will use:
 *   - supabase.from('health_metrics').select() for HRV, HR, sleep
 *   - supabase.from('daily_logs').select() for subjective data
 *   - supabase.from('injuries').select() for active injuries
 *   - Compute fatigue from workout load (TSS decay model)
 */
export function useHealth() {
    // @mock — swap this block
    return {
        fatigueData: mockFatigueData,
        dailyLogs: mockDailyLogs,
        healthSnapshot: mockHealthSnapshot,
        isLoading: false,
    };
}
