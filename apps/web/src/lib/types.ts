// ============================================================
// Frontend Domain Types
// Shared types used by hooks, components, and pages.
// Types here mirror the Supabase schema with camelCase fields.
// ============================================================

// ── Workouts ──────────────────────────────────────────────────

export type Workout = {
    id: string;
    athleteId: string;
    clubId: string;
    activityType: "SWIM" | "BIKE" | "RUN" | "STRENGTH" | "YOGA" | "OTHER";
    source:
    | "GARMIN"
    | "POLAR"
    | "WAHOO"
    | "FORM"
    | "MANUAL"
    | "HEALTHKIT"
    | "HEALTH_CONNECT";
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

// ── Health & Body Map ─────────────────────────────────────────

export type FatigueLevel = "low" | "moderate" | "high";

export type MuscleFatigue = {
    muscle: string;
    bodyPart: string; // Maps to injuries.body_part in Supabase
    level: number; // 0-100
    status: FatigueLevel;
};

export type DailyLog = {
    id: string;
    date: string;
    sleepHours: number;
    sleepQuality: number; // 1-10
    rpe: number; // 1-10
    mood: number; // 1-10
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

// ── Training ──────────────────────────────────────────────────

export type TrainingSession = {
    day: string;
    session: string;
    type: "SWIM" | "BIKE" | "RUN" | "STRENGTH";
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
    status: "draft" | "active" | "completed" | "archived";
    thisWeek: TrainingSession[];
};

export type UpcomingEvent = {
    id: string;
    name: string;
    date: string;
    type: "SPRINT" | "OLYMPIC" | "HALF_IRONMAN" | "IRONMAN" | "CUSTOM";
    location: string;
};

// ── AI Coach ──────────────────────────────────────────────────

export type Message = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
    metadata?: {
        sources?: string[];
        confidence?: number;
        toolCalls?: string[];
        imageUrls?: string[];
    };
};

export type Conversation = {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
};

export const suggestedPrompts = [
    "Why are my legs so tired?",
    "Create a taper plan for my race",
    "Analyze my swim technique trends",
    "What should I eat before a long ride?",
    "Compare my run pace this month vs last",
];

// ── Strength Training ─────────────────────────────────────────

export type MuscleGroup =
    | "chest"
    | "back"
    | "legs"
    | "shoulders"
    | "arms"
    | "core"
    | "full";

export interface StrengthSet {
    id: string;
    weightKg: number;
    reps: number;
    rpe?: number; // 1-10
    type: "warmup" | "working" | "failure" | "drop";
}

export interface StrengthExercise {
    id: string;
    name: string;
    muscleGroup: MuscleGroup;
    sets: StrengthSet[];
    notes?: string;
}

export interface StrengthSessionData {
    focus: string; // e.g., "Legs & Core"
    exercises: StrengthExercise[];
}

// ── Demo / Fallback Data ──────────────────────────────────────

export const defaultFatigueData: MuscleFatigue[] = [
    { muscle: "Quadriceps", bodyPart: "quadriceps", level: 85, status: "high" },
    { muscle: "Hamstrings", bodyPart: "hamstrings", level: 72, status: "high" },
    { muscle: "Calves", bodyPart: "calves", level: 65, status: "moderate" },
    { muscle: "Shoulders", bodyPart: "shoulders", level: 40, status: "moderate" },
    { muscle: "Core", bodyPart: "core", level: 55, status: "moderate" },
    { muscle: "Glutes", bodyPart: "glutes", level: 70, status: "high" },
    { muscle: "Lower Back", bodyPart: "lower_back", level: 45, status: "moderate" },
    { muscle: "Lats", bodyPart: "lats", level: 35, status: "low" },
    { muscle: "Chest", bodyPart: "chest", level: 30, status: "low" },
    { muscle: "Biceps", bodyPart: "biceps", level: 42, status: "moderate" },
    { muscle: "Triceps", bodyPart: "triceps", level: 38, status: "low" },
    { muscle: "Traps", bodyPart: "traps", level: 48, status: "moderate" },
    { muscle: "Forearms", bodyPart: "forearms", level: 25, status: "low" },
    { muscle: "Neck", bodyPart: "neck", level: 20, status: "low" },
    { muscle: "Hip Flexors", bodyPart: "hip_flexors", level: 58, status: "moderate" },
    { muscle: "Adductors", bodyPart: "adductors", level: 52, status: "moderate" },
];
