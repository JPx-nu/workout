// ============================================================
// @mock — Training plan data
// TODO: Replace with Supabase query: supabase.from('training_plans').select()
// See: docs/MOCK_DATA_MIGRATION.md
// ============================================================

export type TrainingSession = {
    day: string;
    session: string;
    type: 'SWIM' | 'BIKE' | 'RUN' | 'STRENGTH';
    done: boolean;
    durationMin?: number;
};

export type TrainingPlan = {
    id: string;
    name: string;
    eventDate: string;
    eventName: string;
    currentWeek: number;
    totalWeeks: number;
    status: 'draft' | 'active' | 'completed' | 'archived';
    thisWeek: TrainingSession[];
};

export const mockTrainingPlan: TrainingPlan = {
    id: 'plan-001',
    name: 'Ironman 70.3 Jönköping — 16-Week Build',
    eventDate: '2026-06-14',
    eventName: 'Ironman 70.3 Jönköping',
    currentWeek: 6,
    totalWeeks: 16,
    status: 'active',
    thisWeek: [
        { day: 'Mon', session: 'Swim: 3×400m threshold', type: 'SWIM', done: true, durationMin: 60 },
        { day: 'Tue', session: 'Bike: 60min sweet spot', type: 'BIKE', done: true, durationMin: 60 },
        { day: 'Wed', session: 'Run: 8×800m intervals', type: 'RUN', done: true, durationMin: 55 },
        { day: 'Thu', session: 'Strength: upper body + core', type: 'STRENGTH', done: false, durationMin: 45 },
        { day: 'Fri', session: 'Swim: 2km easy + drills', type: 'SWIM', done: false, durationMin: 50 },
        { day: 'Sat', session: 'Bike: 3hr endurance ride', type: 'BIKE', done: false, durationMin: 180 },
        { day: 'Sun', session: 'Run: 90min long run', type: 'RUN', done: false, durationMin: 90 },
    ],
};

export type UpcomingEvent = {
    id: string;
    name: string;
    date: string;
    type: 'SPRINT' | 'OLYMPIC' | 'HALF_IRONMAN' | 'IRONMAN' | 'CUSTOM';
    location: string;
};

export const mockUpcomingEvents: UpcomingEvent[] = [
    { id: 'evt-001', name: 'Ironman 70.3 Jönköping', date: '2026-06-14', type: 'HALF_IRONMAN', location: 'Jönköping, Sweden' },
    { id: 'evt-002', name: 'Lidingöloppet Swim', date: '2026-08-22', type: 'CUSTOM', location: 'Lidingö, Sweden' },
    { id: 'evt-003', name: 'Stockholm Sprint Tri', date: '2026-09-05', type: 'SPRINT', location: 'Stockholm, Sweden' },
];
