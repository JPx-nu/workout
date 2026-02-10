// ============================================================
// @mock — Service hook: useTraining
// STATUS: Using mock data
// SWAP TO: Supabase query on training_plans + events tables
// ============================================================

import { useState } from 'react';
import {
    mockTrainingPlan, mockUpcomingEvents,
    type TrainingPlan, type TrainingSession, type UpcomingEvent,
} from '@/lib/mock';

/**
 * Returns current training plan and upcoming events.
 *
 * @mock Currently returns hardcoded mock data.
 * @real Will use:
 *   const { data: plan } = await supabase
 *     .from('training_plans')
 *     .select('*, events(*)')
 *     .eq('athlete_id', userId)
 *     .eq('status', 'active')
 *     .single()
 */
export function useTraining() {
    // @mock — swap this block
    const plan = mockTrainingPlan;
    const events = mockUpcomingEvents;

    // Toggle session done — mock only, real version would update Supabase
    const [sessions, setSessions] = useState<TrainingSession[]>(plan.thisWeek);

    const toggleSession = (index: number) => {
        setSessions((prev) =>
            prev.map((s, i) => (i === index ? { ...s, done: !s.done } : s)),
        );
    };

    const daysUntilEvent = Math.max(0, Math.ceil(
        (new Date(plan.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ));

    const completedCount = sessions.filter((s) => s.done).length;
    const progressPercent = Math.round((plan.currentWeek / plan.totalWeeks) * 100);

    const eventsWithDays: Array<UpcomingEvent & { daysUntil: number }> = events.map((e) => ({
        ...e,
        daysUntil: Math.max(0, Math.ceil(
            (new Date(e.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )),
    }));

    return {
        plan: { ...plan, thisWeek: sessions },
        events: eventsWithDays,
        daysUntilEvent,
        completedCount,
        totalSessions: sessions.length,
        progressPercent,
        toggleSession,
        isLoading: false,
    };
}
