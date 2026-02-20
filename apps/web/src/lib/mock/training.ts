// ============================================================
// Training Plan Types
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

export type UpcomingEvent = {
    id: string;
    name: string;
    date: string;
    type: 'SPRINT' | 'OLYMPIC' | 'HALF_IRONMAN' | 'IRONMAN' | 'CUSTOM';
    location: string;
};
