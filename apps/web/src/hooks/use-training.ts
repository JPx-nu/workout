// ============================================================
// Service hook: useTraining
// Fetches from Supabase training_plans + events tables
// ============================================================

import { daysUntil, progressPercent } from "@triathlon/core";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";
import type { TrainingPlan, TrainingSession, UpcomingEvent } from "@/lib/types";

const emptyPlan: TrainingPlan = {
	id: "",
	name: "",
	eventDate: new Date().toISOString().split("T")[0],
	eventName: "",
	currentWeek: 0,
	totalWeeks: 0,
	status: "draft",
	thisWeek: [],
};

export function useTraining() {
	const { user } = useAuth();
	const [plan, setPlan] = useState<TrainingPlan>(emptyPlan);
	const [events, setEvents] = useState<UpcomingEvent[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Local toggle state for session done
	const [sessions, setSessions] = useState<TrainingSession[]>([]);

	const fetchTraining = useCallback(async () => {
		if (!user) {
			setPlan(emptyPlan);
			setEvents([]);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const supabase = createClient();

		// 1. Fetch active training plan
		const { data: planData, error: planError } = await supabase
			.from("training_plans")
			.select("*")
			.eq("athlete_id", user.id)
			.eq("status", "active")
			.limit(1)
			.maybeSingle();

		if (planError) {
			setError(planError.message);
		}

		if (planData) {
			const planJson = planData.plan_data as {
				thisWeek?: TrainingSession[];
				currentWeek?: number;
				totalWeeks?: number;
			} | null;

			const mapped: TrainingPlan = {
				id: planData.id,
				name: planData.name ?? "",
				eventDate: planData.event_date ?? "",
				eventName: planData.event_name ?? "",
				currentWeek: planJson?.currentWeek ?? planData.current_week ?? 0,
				totalWeeks: planJson?.totalWeeks ?? planData.total_weeks ?? 0,
				status: planData.status ?? "active",
				thisWeek: planJson?.thisWeek ?? [],
			};
			setPlan(mapped);
			setSessions(mapped.thisWeek);
		} else {
			setPlan(emptyPlan);
			setSessions([]);
		}

		// 2. Fetch upcoming events for the user's club
		const today = new Date().toISOString().split("T")[0];
		const { data: eventData, error: eventError } = await supabase
			.from("events")
			.select("*")
			.gte("event_date", today)
			.order("event_date", { ascending: true })
			.limit(10);

		if (eventError && !error) {
			setError(eventError.message);
		}

		if (eventData) {
			setEvents(
				eventData.map((e) => ({
					id: e.id,
					name: e.name ?? "",
					date: e.event_date ?? "",
					type: e.event_type ?? "race",
					location: e.location ?? "",
				})),
			);
		}

		setIsLoading(false);
	}, [user, error]);

	useEffect(() => {
		fetchTraining();
	}, [fetchTraining]);

	const toggleSession = (index: number) => {
		setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, done: !s.done } : s)));
	};

	const daysUntilEvent = daysUntil(plan.eventDate);
	const completedCount = sessions.filter((s) => s.done).length;
	const progressPct = progressPercent(plan.currentWeek, plan.totalWeeks);

	const eventsWithDays: Array<UpcomingEvent & { daysUntil: number }> = events.map((e) => ({
		...e,
		daysUntil: daysUntil(e.date),
	}));

	return {
		plan: { ...plan, thisWeek: sessions },
		events: eventsWithDays,
		daysUntilEvent,
		completedCount,
		totalSessions: sessions.length,
		progressPercent: progressPct,
		toggleSession,
		isLoading,
		error,
	};
}
