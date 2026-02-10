// ============================================================
// @mock — Health & body map data
// TODO: Replace with Supabase queries:
//   - supabase.from('health_metrics').select()
//   - supabase.from('injuries').select()
//   - supabase.from('daily_logs').select()
// See: docs/MOCK_DATA_MIGRATION.md
// ============================================================

export type FatigueLevel = 'low' | 'moderate' | 'high';

export type MuscleFatigue = {
    muscle: string;
    bodyPart: string;   // Maps to injuries.body_part in Supabase
    level: number;      // 0-100
    status: FatigueLevel;
};

export type DailyLog = {
    id: string;
    date: string;
    sleepHours: number;
    sleepQuality: number;  // 1-10
    rpe: number;           // 1-10
    mood: number;          // 1-10
    hrv: number;
    restingHr: number;
    weightKg: number;
    notes: string | null;
};

export type HealthSnapshot = {
    hrv: number;
    restingHr: number;
    sleepHours: number;
    sleepQuality: number;
    vo2max: number;
    weightKg: number;
    readinessScore: number;
};

export const mockFatigueData: MuscleFatigue[] = [
    { muscle: 'Quadriceps', bodyPart: 'quadriceps', level: 85, status: 'high' },
    { muscle: 'Hamstrings', bodyPart: 'hamstrings', level: 72, status: 'high' },
    { muscle: 'Calves', bodyPart: 'calves', level: 65, status: 'moderate' },
    { muscle: 'Shoulders', bodyPart: 'shoulders', level: 40, status: 'moderate' },
    { muscle: 'Core', bodyPart: 'core', level: 55, status: 'moderate' },
    { muscle: 'Glutes', bodyPart: 'glutes', level: 70, status: 'high' },
    { muscle: 'Lower Back', bodyPart: 'lower_back', level: 45, status: 'moderate' },
    { muscle: 'Lats', bodyPart: 'lats', level: 35, status: 'low' },
    { muscle: 'Chest', bodyPart: 'chest', level: 30, status: 'low' },
    { muscle: 'Biceps', bodyPart: 'biceps', level: 42, status: 'moderate' },
    { muscle: 'Triceps', bodyPart: 'triceps', level: 38, status: 'low' },
    { muscle: 'Traps', bodyPart: 'traps', level: 48, status: 'moderate' },
    { muscle: 'Forearms', bodyPart: 'forearms', level: 25, status: 'low' },
    { muscle: 'Neck', bodyPart: 'neck', level: 20, status: 'low' },
    { muscle: 'Hip Flexors', bodyPart: 'hip_flexors', level: 58, status: 'moderate' },
    { muscle: 'Adductors', bodyPart: 'adductors', level: 52, status: 'moderate' },
];

export const mockDailyLogs: DailyLog[] = [
    { id: 'dl-001', date: '2026-02-10', sleepHours: 6.2, sleepQuality: 5, rpe: 7, mood: 6, hrv: 57, restingHr: 52, weightKg: 74.5, notes: 'Legs still tired' },
    { id: 'dl-002', date: '2026-02-09', sleepHours: 7.1, sleepQuality: 7, rpe: 6, mood: 7, hrv: 61, restingHr: 50, weightKg: 74.3, notes: null },
    { id: 'dl-003', date: '2026-02-08', sleepHours: 7.5, sleepQuality: 8, rpe: 5, mood: 8, hrv: 65, restingHr: 49, weightKg: 74.1, notes: 'Great sleep, feeling fresh' },
    { id: 'dl-004', date: '2026-02-07', sleepHours: 6.8, sleepQuality: 6, rpe: 8, mood: 6, hrv: 55, restingHr: 53, weightKg: 74.6, notes: 'Hard run day' },
    { id: 'dl-005', date: '2026-02-06', sleepHours: 8.0, sleepQuality: 9, rpe: 4, mood: 9, hrv: 68, restingHr: 48, weightKg: 74.0, notes: 'Rest day, perfect recovery' },
    { id: 'dl-006', date: '2026-02-05', sleepHours: 7.3, sleepQuality: 7, rpe: 7, mood: 7, hrv: 62, restingHr: 50, weightKg: 74.2, notes: null },
    { id: 'dl-007', date: '2026-02-04', sleepHours: 6.5, sleepQuality: 6, rpe: 6, mood: 7, hrv: 60, restingHr: 51, weightKg: 74.4, notes: null },
];

export const mockHealthSnapshot: HealthSnapshot = {
    hrv: 57,
    restingHr: 52,
    sleepHours: 6.2,
    sleepQuality: 5,
    vo2max: 52.3,
    weightKg: 74.5,
    readinessScore: 72,
};
