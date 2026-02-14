// ============================================================
// @mock — Strength Training Data
// Structured data for 'raw_data' column in workouts table
// ============================================================

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full';

export interface StrengthSet {
    id: string;
    weightKg: number;
    reps: number;
    rpe?: number; // 1-10
    type: 'warmup' | 'working' | 'failure' | 'drop';
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

// Mock Data for specific workouts
export const mockStrengthSessions: Record<string, StrengthSessionData> = {
    'w-004': { // Matches mock/workouts.ts w-004
        focus: 'Lower Body Power',
        exercises: [
            {
                id: 'ex-1', name: 'Back Squat', muscleGroup: 'legs',
                sets: [
                    { id: 's-1-1', weightKg: 60, reps: 10, type: 'warmup' },
                    { id: 's-1-2', weightKg: 80, reps: 5, type: 'working', rpe: 7 },
                    { id: 's-1-3', weightKg: 80, reps: 5, type: 'working', rpe: 7.5 },
                    { id: 's-1-4', weightKg: 80, reps: 5, type: 'working', rpe: 8 },
                ]
            },
            {
                id: 'ex-2', name: 'Deadlift', muscleGroup: 'back',
                sets: [
                    { id: 's-2-1', weightKg: 100, reps: 5, type: 'working', rpe: 8 },
                    { id: 's-2-2', weightKg: 100, reps: 5, type: 'working', rpe: 8.5 },
                ]
            },
            {
                id: 'ex-3', name: 'Walking Lunges', muscleGroup: 'legs',
                sets: [
                    { id: 's-3-1', weightKg: 20, reps: 12, type: 'working' },
                    { id: 's-3-2', weightKg: 20, reps: 12, type: 'working' },
                    { id: 's-3-3', weightKg: 20, reps: 12, type: 'working' },
                ]
            }
        ]
    },
    'w-strength-recent-1': {
        focus: 'Upper Body Hypertrophy',
        exercises: [
            {
                id: 'ex-u-1', name: 'Bench Press', muscleGroup: 'chest',
                sets: [
                    { id: 's-u-1', weightKg: 60, reps: 12, type: 'warmup' },
                    { id: 's-u-2', weightKg: 80, reps: 8, type: 'working', rpe: 8 },
                    { id: 's-u-3', weightKg: 80, reps: 8, type: 'working', rpe: 9 },
                    { id: 's-u-4', weightKg: 80, reps: 7, type: 'failure', rpe: 10 },
                ]
            },
            {
                id: 'ex-u-2', name: 'Pull Ups', muscleGroup: 'back',
                sets: [
                    { id: 's-p-1', weightKg: 0, reps: 10, type: 'working' },
                    { id: 's-p-2', weightKg: 0, reps: 9, type: 'working' },
                    { id: 's-p-3', weightKg: 0, reps: 8, type: 'working' },
                ]
            }
        ]
    }
};
