// ============================================================
// @triathlon/types — Shared TypeScript types
// ============================================================

// Activity types
export type ActivityType = 'SWIM' | 'BIKE' | 'RUN' | 'STRENGTH' | 'YOGA' | 'OTHER';

// Data sources
export type DataSource =
    | 'GARMIN' | 'POLAR' | 'WAHOO' | 'FORM'
    | 'MANUAL' | 'HEALTHKIT' | 'HEALTH_CONNECT';

// User roles
export type UserRole = 'athlete' | 'coach' | 'admin' | 'owner';

// Race distance types
export type RaceDistanceType = 'SPRINT' | 'OLYMPIC' | 'HALF_IRONMAN' | 'IRONMAN' | 'CUSTOM';

// Health metric types
export type HealthMetricType =
    | 'SLEEP_HOURS' | 'SLEEP_STAGES' | 'HRV' | 'RESTING_HR'
    | 'SPO2' | 'STEPS' | 'ACTIVE_CALORIES' | 'VO2MAX';

// Knowledge graph entity types
export type KGEntityType =
    | 'ATHLETE' | 'WORKOUT' | 'INJURY' | 'EQUIPMENT'
    | 'CLUB_RULE' | 'DOCUMENT_CHUNK' | 'EVENT' | 'FATIGUE_STATE';

// Knowledge graph relationship types
export type KGRelationship =
    | 'PERFORMED' | 'CAUSED' | 'RECOMMENDS' | 'RESTRICTS'
    | 'HAS_INJURY' | 'USES_EQUIPMENT' | 'LINKED_TO' | 'REFERS_TO';

// AI chat intent
export type ChatIntent = 'training' | 'medical' | 'general' | 'emergency';

// Chat message role
export type ChatRole = 'user' | 'assistant' | 'system';

// ============================================================
// Core domain interfaces
// ============================================================

export interface Club {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Profile {
    id: string;
    club_id: string;
    role: UserRole;
    display_name: string | null;
    avatar_url: string | null;
    timezone: string;
    preferences: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Workout {
    id: string;
    athlete_id: string;
    club_id: string;
    activity_type: ActivityType;
    source: DataSource;
    started_at: string;
    duration_s: number | null;
    distance_m: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    avg_pace_s_km: number | null;
    avg_power_w: number | null;
    calories: number | null;
    tss: number | null;
    raw_data: Record<string, unknown> | null;
    notes: string | null;
    created_at: string;
}

export interface DailyLog {
    id: string;
    athlete_id: string;
    club_id: string;
    log_date: string;
    sleep_hours: number | null;
    sleep_quality: number | null;
    rpe: number | null;
    mood: number | null;
    hrv: number | null;
    resting_hr: number | null;
    weight_kg: number | null;
    notes: string | null;
    created_at: string;
}

export interface Injury {
    id: string;
    athlete_id: string;
    club_id: string;
    body_part: string;
    severity: number | null;
    reported_at: string;
    resolved_at: string | null;
    notes: string | null;
}

export interface HealthMetric {
    id: string;
    athlete_id: string;
    club_id: string;
    metric_type: HealthMetricType;
    value: number;
    unit: string | null;
    recorded_at: string;
    source: 'HEALTHKIT' | 'HEALTH_CONNECT' | 'MANUAL' | null;
    raw_data: Record<string, unknown> | null;
    created_at: string;
}

export interface ChatMessage {
    id: string;
    conversation_id: string;
    role: ChatRole;
    content: string;
    metadata: {
        model?: string;
        sources?: string[];
        confidence?: number;
        intent?: ChatIntent;
    };
    created_at: string;
}

// ============================================================
// Normalized workout (from webhook transformers)
// ============================================================

export interface StandardWorkout {
    activity_type: ActivityType;
    source: DataSource;
    started_at: string;
    duration_s: number;
    distance_m: number;
    avg_hr?: number;
    max_hr?: number;
    avg_pace_s_km?: number;
    avg_power_w?: number;
    calories?: number;
    tss?: number;
    raw_data: Record<string, unknown>;
}
