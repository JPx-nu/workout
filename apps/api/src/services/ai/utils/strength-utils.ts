// ============================================================
// Strength Training Utility Functions
// Pure functions for 1RM estimation, volume computation,
// and workout summarization.
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export interface SetData {
    reps: number;
    weight_kg: number;
    rpe?: number;
    rir?: number;
    tempo?: string;
    set_type?: 'working' | 'warmup' | 'dropset' | 'backoff' | 'amrap' | 'cluster';
}

export interface ExerciseData {
    name: string;
    sets: SetData[];
    group_id?: number;
    group_type?: 'superset' | 'circuit' | 'giant_set';
    notes?: string;
}

export interface ExerciseSummary {
    name: string;
    workingSets: number;
    topSet: { weight_kg: number; reps: number; rpe?: number } | null;
    totalVolume_kg: number;
    estimated1RM_kg: number | null;
    group_id?: number;
    group_type?: string;
}

// ── 1RM Estimation ────────────────────────────────────────────

/**
 * Rep-range-adaptive 1RM estimation.
 *
 * Formula selection based on research accuracy:
 *   - 1 rep   → identity (actual 1RM)
 *   - ≤6 reps → Brzycki (most accurate for heavy loads)
 *   - 7–10    → Epley (best for moderate rep ranges)
 *   - >10     → Lombardi (most conservative, avoids overestimation)
 *
 * Returns the estimated 1RM in the same unit as weight, rounded to 1 decimal.
 */
export function estimate1RM(weight: number, reps: number): number | null {
    if (weight <= 0 || reps <= 0) return null;
    if (reps === 1) return weight;

    let estimate: number;

    if (reps <= 6) {
        // Brzycki: 1RM = W / (1.0278 − 0.0278 × R)
        const denominator = 1.0278 - 0.0278 * reps;
        if (denominator <= 0) return null; // safety: avoids division by zero at ~37 reps
        estimate = weight / denominator;
    } else if (reps <= 10) {
        // Epley: 1RM = W × (1 + R / 30)
        estimate = weight * (1 + reps / 30);
    } else {
        // Lombardi: 1RM = W × R^0.10
        estimate = weight * Math.pow(reps, 0.10);
    }

    return Math.round(estimate * 10) / 10;
}

// ── Volume Computation ────────────────────────────────────────

/**
 * Compute total volume (weight × reps) from working sets only.
 * Excludes warmup sets.
 */
export function computeVolume(sets: SetData[]): number {
    return sets
        .filter((s) => s.set_type !== 'warmup')
        .reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
}

/**
 * Find the "top set" — the working set with the highest estimated 1RM.
 * This is more meaningful than just the heaviest weight (e.g., 3×100 > 1×105 in some cases).
 */
export function findTopSet(sets: SetData[]): SetData | null {
    const workingSets = sets.filter((s) => s.set_type !== 'warmup');
    if (workingSets.length === 0) return null;

    let best: SetData | null = null;
    let bestE1RM = 0;

    for (const s of workingSets) {
        const e1rm = estimate1RM(s.weight_kg, s.reps);
        if (e1rm !== null && e1rm > bestE1RM) {
            bestE1RM = e1rm;
            best = s;
        }
    }

    return best;
}

// ── Workout Summarization ─────────────────────────────────────

/**
 * Parse raw_data from a STRENGTH workout into a compact summary
 * suitable for LLM consumption. Minimizes token usage while
 * preserving all coaching-relevant data points.
 */
export function summarizeStrengthWorkout(rawData: unknown): ExerciseSummary[] {
    if (!rawData || typeof rawData !== 'object') return [];

    const data = rawData as Record<string, unknown>;
    const exercises = data.exercises as ExerciseData[] | undefined;
    if (!Array.isArray(exercises)) return [];

    return exercises.map((ex) => {
        const workingSets = ex.sets.filter((s) => s.set_type !== 'warmup');
        const topSet = findTopSet(ex.sets);
        const totalVolume = computeVolume(ex.sets);
        const e1rm = topSet ? estimate1RM(topSet.weight_kg, topSet.reps) : null;

        return {
            name: ex.name,
            workingSets: workingSets.length,
            topSet: topSet
                ? { weight_kg: topSet.weight_kg, reps: topSet.reps, rpe: topSet.rpe }
                : null,
            totalVolume_kg: totalVolume,
            estimated1RM_kg: e1rm,
            ...(ex.group_id !== undefined && { group_id: ex.group_id }),
            ...(ex.group_type && { group_type: ex.group_type }),
        };
    });
}

/**
 * Compute the average RPE across all working sets in a workout's exercises.
 */
export function computeAverageRPE(exercises: ExerciseData[]): number | null {
    const rpeValues: number[] = [];
    for (const ex of exercises) {
        for (const s of ex.sets) {
            if (s.set_type !== 'warmup' && s.rpe !== undefined) {
                rpeValues.push(s.rpe);
            }
        }
    }
    if (rpeValues.length === 0) return null;
    return Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10;
}

/**
 * Compute total session volume across all exercises.
 */
export function computeSessionVolume(exercises: ExerciseData[]): number {
    return exercises.reduce((sum, ex) => sum + computeVolume(ex.sets), 0);
}
