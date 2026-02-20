// ============================================================
// Service hook: useHealth
// Fetches from Supabase daily_logs + injuries tables
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/supabase-provider";
import type {
	DailyLog,
	FatigueLevel,
	HealthSnapshot,
	MuscleFatigue,
} from "@/lib/mock/health";
import { createClient } from "@/lib/supabase/client";

const defaultSnapshot: HealthSnapshot = {
	hrv: 0,
	restingHr: 0,
	sleepHours: 0,
	sleepQuality: 0,
	vo2max: 0,
	weightKg: 0,
	readinessScore: 0,
};

/* ─── Default muscle groups (always shown, even with no injuries) ─── */
const DEFAULT_MUSCLE_GROUPS: MuscleFatigue[] = [
	{ muscle: "Quadriceps", bodyPart: "quadriceps", level: 0, status: "low" },
	{ muscle: "Hamstrings", bodyPart: "hamstrings", level: 0, status: "low" },
	{ muscle: "Calves", bodyPart: "calves", level: 0, status: "low" },
	{ muscle: "Shoulders", bodyPart: "shoulders", level: 0, status: "low" },
	{ muscle: "Core", bodyPart: "core", level: 0, status: "low" },
	{ muscle: "Glutes", bodyPart: "glutes", level: 0, status: "low" },
	{ muscle: "Lower Back", bodyPart: "lower_back", level: 0, status: "low" },
	{ muscle: "Lats", bodyPart: "lats", level: 0, status: "low" },
	{ muscle: "Chest", bodyPart: "chest", level: 0, status: "low" },
	{ muscle: "Biceps", bodyPart: "biceps", level: 0, status: "low" },
	{ muscle: "Triceps", bodyPart: "triceps", level: 0, status: "low" },
	{ muscle: "Traps", bodyPart: "traps", level: 0, status: "low" },
	{ muscle: "Forearms", bodyPart: "forearms", level: 0, status: "low" },
	{ muscle: "Neck", bodyPart: "neck", level: 0, status: "low" },
	{ muscle: "Hip Flexors", bodyPart: "hip_flexors", level: 0, status: "low" },
	{ muscle: "Adductors", bodyPart: "adductors", level: 0, status: "low" },
];

export function useHealth() {
	const { user } = useAuth();
	const [fatigueData, setFatigueData] = useState<MuscleFatigue[]>(
		DEFAULT_MUSCLE_GROUPS,
	);
	const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
	const [healthSnapshot, setHealthSnapshot] =
		useState<HealthSnapshot>(defaultSnapshot);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchHealth = useCallback(async () => {
		if (!user) {
			setFatigueData(DEFAULT_MUSCLE_GROUPS);
			setDailyLogs([]);
			setHealthSnapshot(defaultSnapshot);
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
			const mapped: DailyLog[] = logData.map((row) => ({
				id: row.id,
				date: row.log_date,
				sleepHours: row.sleep_hours ?? 0,
				sleepQuality: row.sleep_quality ?? 5,
				rpe: row.rpe ?? 5,
				mood: row.mood ?? 5,
				hrv: row.hrv ?? 0,
				restingHr: row.resting_hr ?? 0,
				weightKg: row.weight_kg ?? 0,
				notes: row.notes ?? null,
			}));
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
				readinessScore: Math.min(
					100,
					Math.round(
						(latest.sleepQuality * 10 +
							latest.mood * 5 +
							(latest.hrv > 0 ? 30 : 0)) /
							1.4,
					),
				),
			});
		} else {
			setDailyLogs([]);
			setHealthSnapshot(defaultSnapshot);
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

		// Build a map of injury fatigue, keyed by body_part
		const injuryMap = new Map<string, MuscleFatigue>();
		if (injuryData && injuryData.length > 0) {
			for (const inj of injuryData) {
				const severity = inj.severity ?? 50;
				let status: FatigueLevel = "low";
				if (severity >= 70) status = "high";
				else if (severity >= 40) status = "moderate";

				injuryMap.set(inj.body_part ?? "", {
					muscle: inj.body_part ?? "Unknown",
					bodyPart: inj.body_part ?? "",
					level: severity,
					status,
				});
			}
		}

		// Merge: default groups with any injury overrides
		const merged = DEFAULT_MUSCLE_GROUPS.map((def) => {
			const override = injuryMap.get(def.bodyPart);
			return override ?? def;
		});

		// Add any injuries that don't match a default group
		for (const [bodyPart, data] of injuryMap) {
			if (!DEFAULT_MUSCLE_GROUPS.some((d) => d.bodyPart === bodyPart)) {
				merged.push(data);
			}
		}

		setFatigueData(merged);
		setIsLoading(false);
	}, [user, error]);

	useEffect(() => {
		fetchHealth();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	return {
		fatigueData,
		dailyLogs,
		healthSnapshot,
		isLoading,
		error,
	};
}
