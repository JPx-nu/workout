// ============================================================
// @mock — Workout data
// TODO: Replace with Supabase query: supabase.from('workouts').select()
// See: docs/MOCK_DATA_MIGRATION.md
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

export const mockWorkouts: Workout[] = [
    {
        id: 'w-001', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'RUN', source: 'GARMIN',
        startedAt: '2026-02-10T07:00:00Z', durationSec: 3120,
        distanceM: 10200, avgHr: 148, maxHr: 172, avgPaceSecKm: 306, avgPowerW: null,
        calories: 620, tss: 72, notes: 'Tempo intervals, felt strong',
    },
    {
        id: 'w-002', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'SWIM', source: 'FORM',
        startedAt: '2026-02-09T06:30:00Z', durationSec: 3900,
        distanceM: 3200, avgHr: 132, maxHr: 155, avgPaceSecKm: null, avgPowerW: null,
        calories: 480, tss: 58, notes: 'Drill set + 10×100m threshold',
    },
    {
        id: 'w-003', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'BIKE', source: 'WAHOO',
        startedAt: '2026-02-08T16:00:00Z', durationSec: 5400,
        distanceM: 45000, avgHr: 142, maxHr: 168, avgPaceSecKm: null, avgPowerW: 218,
        calories: 820, tss: 95, notes: 'Sweet spot intervals on trainer',
    },
    {
        id: 'w-004', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'STRENGTH', source: 'MANUAL',
        startedAt: '2026-02-08T08:00:00Z', durationSec: 2700,
        distanceM: null, avgHr: 110, maxHr: 135, avgPaceSecKm: null, avgPowerW: null,
        calories: 280, tss: 35, notes: 'Lower body focus — squats, lunges, deadlifts',
    },
    {
        id: 'w-005', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'RUN', source: 'GARMIN',
        startedAt: '2026-02-07T12:00:00Z', durationSec: 2280,
        distanceM: 7500, avgHr: 138, maxHr: 152, avgPaceSecKm: 304, avgPowerW: null,
        calories: 410, tss: 48, notes: 'Easy recovery run, Djurgården loop',
    },
    {
        id: 'w-006', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'BIKE', source: 'WAHOO',
        startedAt: '2026-02-06T17:00:00Z', durationSec: 10800,
        distanceM: 82000, avgHr: 135, maxHr: 158, avgPaceSecKm: null, avgPowerW: 195,
        calories: 1650, tss: 165, notes: 'Long endurance ride — Roslagen coast',
    },
    {
        id: 'w-007', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'SWIM', source: 'FORM',
        startedAt: '2026-02-06T06:00:00Z', durationSec: 3000,
        distanceM: 2500, avgHr: 128, maxHr: 148, avgPaceSecKm: null, avgPowerW: null,
        calories: 350, tss: 42, notes: 'Technique + pull set, SWOLF improved',
    },
    {
        id: 'w-008', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'RUN', source: 'POLAR',
        startedAt: '2026-02-05T07:30:00Z', durationSec: 4500,
        distanceM: 15000, avgHr: 145, maxHr: 170, avgPaceSecKm: 300, avgPowerW: null,
        calories: 950, tss: 88, notes: 'Progression long run — negative split',
    },
    {
        id: 'w-009', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'SWIM', source: 'FORM',
        startedAt: '2026-02-04T06:30:00Z', durationSec: 3600,
        distanceM: 2800, avgHr: 130, maxHr: 150, avgPaceSecKm: null, avgPowerW: null,
        calories: 420, tss: 50, notes: 'Open water simulation set',
    },
    {
        id: 'w-010', athleteId: 'mock-user-001', clubId: 'mock-club-001',
        activityType: 'BIKE', source: 'WAHOO',
        startedAt: '2026-02-03T17:30:00Z', durationSec: 3600,
        distanceM: 30000, avgHr: 138, maxHr: 162, avgPaceSecKm: null, avgPowerW: 225,
        calories: 560, tss: 75, notes: 'VO₂max intervals — 5×4min at 110% FTP',
    },
];

export const mockWeeklyStats: WeeklyStats = {
    swim: { sessions: 3, distanceKm: 8.5, durationMin: 195 },
    bike: { sessions: 4, distanceKm: 210, durationMin: 420 },
    run: { sessions: 5, distanceKm: 42, durationMin: 255 },
    strength: { sessions: 2, durationMin: 90 },
    totalTSS: 685,
    readinessScore: 72,
};

export const mockActivityChartData: ChartDataPoint[] = [
    { day: 'Mon', swim: 45, bike: 0, run: 35, strength: 0 },
    { day: 'Tue', swim: 0, bike: 75, run: 0, strength: 45 },
    { day: 'Wed', swim: 60, bike: 0, run: 45, strength: 0 },
    { day: 'Thu', swim: 0, bike: 90, run: 0, strength: 45 },
    { day: 'Fri', swim: 45, bike: 0, run: 50, strength: 0 },
    { day: 'Sat', swim: 0, bike: 180, run: 0, strength: 0 },
    { day: 'Sun', swim: 45, bike: 75, run: 80, strength: 0 },
];
