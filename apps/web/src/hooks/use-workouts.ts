// ============================================================
// Service hook: useWorkouts
// Fetches from Supabase workouts table, computes stats & chart data
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/supabase-provider';
import type { Workout, WeeklyStats, ChartDataPoint } from '@/lib/mock/workouts';

type ActivityFilter = 'ALL' | 'SWIM' | 'BIKE' | 'RUN' | 'STRENGTH';

// ---- DB row → frontend type ----
type DbWorkout = {
    id: string;
    athlete_id: string;
    club_id: string | null;
    activity_type: string;
    source: string;
    started_at: string;
    duration_s: number;
    distance_m: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    avg_pace_s_km: number | null;
    avg_power_w: number | null;
    calories: number | null;
    tss: number | null;
    notes: string | null;
};

function mapWorkout(row: DbWorkout): Workout {
    return {
        id: row.id,
        athleteId: row.athlete_id,
        clubId: row.club_id ?? '',
        activityType: row.activity_type as Workout['activityType'],
        source: row.source as Workout['source'],
        startedAt: row.started_at,
        durationSec: row.duration_s,
        distanceM: row.distance_m,
        avgHr: row.avg_hr,
        maxHr: row.max_hr,
        avgPaceSecKm: row.avg_pace_s_km,
        avgPowerW: row.avg_power_w,
        calories: row.calories,
        tss: row.tss,
        notes: row.notes,
    };
}

// ---- Compute weekly stats from workouts in the last 7 days ----
function computeWeeklyStats(workouts: Workout[]): WeeklyStats {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = workouts.filter((w) => new Date(w.startedAt).getTime() >= weekAgo);

    const byType = (type: string) => thisWeek.filter((w) => w.activityType === type);

    const swimW = byType('SWIM');
    const bikeW = byType('BIKE');
    const runW = byType('RUN');
    const strengthW = byType('STRENGTH');

    const sumDurMin = (arr: Workout[]) => Math.round(arr.reduce((a, w) => a + w.durationSec, 0) / 60);
    const sumDistKm = (arr: Workout[]) =>
        Math.round(arr.reduce((a, w) => a + (w.distanceM ?? 0), 0) / 100) / 10;

    return {
        swim: { sessions: swimW.length, distanceKm: sumDistKm(swimW), durationMin: sumDurMin(swimW) },
        bike: { sessions: bikeW.length, distanceKm: sumDistKm(bikeW), durationMin: sumDurMin(bikeW) },
        run: { sessions: runW.length, distanceKm: sumDistKm(runW), durationMin: sumDurMin(runW) },
        strength: { sessions: strengthW.length, durationMin: sumDurMin(strengthW) },
        totalTSS: Math.round(thisWeek.reduce((a, w) => a + (w.tss ?? 0), 0)),
        readinessScore: Math.min(100, Math.max(0, 100 - Math.round(thisWeek.reduce((a, w) => a + (w.tss ?? 0), 0) / 5))),
    };
}

// ---- Compute 7-day stacked chart data ----
function computeChartData(workouts: Workout[]): ChartDataPoint[] {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay() || 7; // Mon=1..Sun=7
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    return days.map((day, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dayStr = date.toISOString().split('T')[0];
        const dayWorkouts = workouts.filter((w) => w.startedAt.startsWith(dayStr));

        const minutesByType = (type: string) =>
            Math.round(dayWorkouts.filter((w) => w.activityType === type).reduce((a, w) => a + w.durationSec, 0) / 60);

        return {
            day,
            swim: minutesByType('SWIM'),
            bike: minutesByType('BIKE'),
            run: minutesByType('RUN'),
            strength: minutesByType('STRENGTH'),
        };
    });
}

export function useWorkouts() {
    const { user } = useAuth();
    const [filter, setFilter] = useState<ActivityFilter>('ALL');
    const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkouts = useCallback(async () => {
        if (!user) {
            setAllWorkouts([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const supabase = createClient();
        const { data, error: dbError } = await supabase
            .from('workouts')
            .select('*')
            .eq('athlete_id', user.id)
            .order('started_at', { ascending: false });

        if (dbError) {
            setError(dbError.message);
            setAllWorkouts([]);
        } else {
            setAllWorkouts((data as DbWorkout[]).map(mapWorkout));
        }
        setIsLoading(false);
    }, [user]);

    useEffect(() => {
        fetchWorkouts();
    }, [fetchWorkouts]);

    const filtered = useMemo(() => {
        if (filter === 'ALL') return allWorkouts;
        return allWorkouts.filter((w) => w.activityType === filter);
    }, [allWorkouts, filter]);

    const weeklyStats = useMemo(() => computeWeeklyStats(allWorkouts), [allWorkouts]);
    const chartData = useMemo(() => computeChartData(allWorkouts), [allWorkouts]);

    return {
        workouts: filtered,
        allWorkouts,
        weeklyStats,
        chartData,
        filter,
        setFilter,
        isLoading,
        error,
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
