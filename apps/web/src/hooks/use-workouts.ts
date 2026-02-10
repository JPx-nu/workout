// ============================================================
// @mock — Service hook: useWorkouts
// STATUS: Using mock data
// SWAP TO: Supabase query on workouts table
// ============================================================

import { useState, useMemo } from 'react';
import {
    mockWorkouts, mockWeeklyStats, mockActivityChartData,
    type Workout, type WeeklyStats, type ChartDataPoint,
} from '@/lib/mock';

type ActivityFilter = 'ALL' | 'SWIM' | 'BIKE' | 'RUN' | 'STRENGTH';

/**
 * Returns workouts with filtering, stats, and chart data.
 *
 * @mock Currently returns hardcoded mock data.
 * @real Will use:
 *   const { data } = await supabase
 *     .from('workouts')
 *     .select('*')
 *     .eq('athlete_id', userId)
 *     .order('started_at', { ascending: false })
 */
export function useWorkouts() {
    const [filter, setFilter] = useState<ActivityFilter>('ALL');

    // @mock — swap this block
    const allWorkouts = mockWorkouts;
    const weeklyStats = mockWeeklyStats;
    const chartData = mockActivityChartData;

    const filtered = useMemo(() => {
        if (filter === 'ALL') return allWorkouts;
        return allWorkouts.filter((w) => w.activityType === filter);
    }, [allWorkouts, filter]);

    return {
        workouts: filtered,
        allWorkouts,
        weeklyStats,
        chartData,
        filter,
        setFilter,
        isLoading: false,
    };
}

// Helper: convert Supabase-schema seconds → display minutes
export function secToMin(sec: number): number {
    return Math.round(sec / 60);
}

// Helper: convert meters → km display
export function mToKm(m: number): number {
    return Math.round((m / 1000) * 10) / 10;
}

// Helper: format duration from seconds
export function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Helper: format pace from seconds and meters
export function formatPace(durationSec: number, distanceM: number): string {
    if (!distanceM) return '—';
    const paceSecPerKm = (durationSec / distanceM) * 1000;
    const min = Math.floor(paceSecPerKm / 60);
    const sec = Math.round(paceSecPerKm % 60);
    return `${min}:${sec.toString().padStart(2, '0')}/km`;
}
