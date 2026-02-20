// ============================================================
// Workout Types
// ============================================================

export type Workout = {
    id: string;
    athleteId: string;
    clubId: string;
    activityType: 'SWIM' | 'BIKE' | 'RUN' | 'STRENGTH' | 'YOGA' | 'OTHER';
    source: 'GARMIN' | 'POLAR' | 'WAHOO' | 'FORM' | 'MANUAL' | 'HEALTHKIT' | 'HEALTH_CONNECT';
    startedAt: string;
    durationSec: number;
    distanceM: number | null;
    avgHr: number | null;
    maxHr: number | null;
    avgPaceSecKm: number | null;
    avgPowerW: number | null;
    calories: number | null;
    tss: number | null;
    notes: string | null;
    rawData?: Record<string, unknown>;
};

export type WeeklyStats = {
    swim: { sessions: number; distanceKm: number; durationMin: number };
    bike: { sessions: number; distanceKm: number; durationMin: number };
    run: { sessions: number; distanceKm: number; durationMin: number };
    strength: { sessions: number; durationMin: number };
    totalTSS: number;
    readinessScore: number;
};

export type ChartDataPoint = {
    day: string;
    swim: number;
    bike: number;
    run: number;
    strength: number;
};
