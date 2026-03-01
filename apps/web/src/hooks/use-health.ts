// ============================================================
// Service hook: useHealth
// Fetches from Supabase daily_logs + injuries tables
// ============================================================

import type { HealthSnapshot, MappedDailyLog, MuscleFatigue } from "@triathlon/core";
import {
	computeReadinessScore,
	DEFAULT_HEALTH_SNAPSHOT,
	DEFAULT_MUSCLE_GROUPS,
	mapDailyLogRow,
	mergeInjuriesToMuscleGroups,
} from "@triathlon/core";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import { createClient } from "@/lib/supabase/client";

export function useHealth() {
	const { user } = useAuth();
	const [fatigueData, setFatigueData] = useState<MuscleFatigue[]>(DEFAULT_MUSCLE_GROUPS);
	const [dailyLogs, setDailyLogs] = useState<MappedDailyLog[]>([]);
	const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot>(DEFAULT_HEALTH_SNAPSHOT);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchHealth = useCallback(async () => {
		if (!user) {
			setFatigueData(DEFAULT_MUSCLE_GROUPS);
			setDailyLogs([]);
			setHealthSnapshot(DEFAULT_HEALTH_SNAPSHOT);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		const supabase = createClient();

		// 1. Fetch last 7 daily logs
		const { data: logData, error: logError } = await supabase
			.from("daily_logs")
			.select("*")
			.eq("athlete_id", user.id)
			.order("log_date", { ascending: false })
			.limit(7);

		if (logError) {
			setError(logError.message);
		}

		if (logData && logData.length > 0) {
			const mapped = logData.map(mapDailyLogRow);
			setDailyLogs(mapped);

			// Build health snapshot from the latest log
			const latest = mapped[0];
			setHealthSnapshot({
				hrv: latest.hrv,
				restingHr: latest.restingHr,
				sleepHours: latest.sleepHours,
				sleepQuality: latest.sleepQuality,
				vo2max: 0, // no direct source yet
				weightKg: latest.weightKg,
				readinessScore: computeReadinessScore(latest.sleepQuality, latest.mood, latest.hrv),
			});
		} else {
			setDailyLogs([]);
			setHealthSnapshot(DEFAULT_HEALTH_SNAPSHOT);
		}

		// 2. Fetch active injuries → merge into default muscle groups
		const { data: injuryData, error: injuryError } = await supabase
			.from("injuries")
			.select("*")
			.eq("athlete_id", user.id)
			.is("resolved_at", null);

		if (injuryError && !error) {
			setError(injuryError.message);
		}

		if (injuryData && injuryData.length > 0) {
			setFatigueData(mergeInjuriesToMuscleGroups(injuryData));
		} else {
			setFatigueData(DEFAULT_MUSCLE_GROUPS);
		}

		setIsLoading(false);
	}, [user, error]);

	useEffect(() => {
		fetchHealth();
	}, [fetchHealth]);

	return {
		fatigueData,
		dailyLogs,
		healthSnapshot,
		isLoading,
		error,
	};
}
