// ============================================================
// Workout & Health Statistics
// Pure aggregation functions for computing stats from workout
// and health data arrays.
// ============================================================

import { toIsoDate } from "./dates";

// ── Types ─────────────────────────────────────────────────────

export type ActivityStats = {
	sessions: number;
	distanceKm: number;
	durationMin: number;
};

export type WeeklyStats = {
	swim: ActivityStats;
	bike: ActivityStats;
	run: ActivityStats;
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

/** Minimal workout shape needed for stats computation. */
export type WorkoutLike = {
	activityType: string;
	startedAt: string;
	durationSec: number;
	distanceM: number | null;
	tss: number | null;
};

// ── Weekly Stats ──────────────────────────────────────────────

/** Compute weekly stats from workouts in the last 7 days. */
export function computeWeeklyStats(workouts: WorkoutLike[]): WeeklyStats {
	const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
	const thisWeek = workouts.filter((w) => new Date(w.startedAt).getTime() >= weekAgo);

	const byType = (type: string) => thisWeek.filter((w) => w.activityType === type);
	const sumDurMin = (arr: WorkoutLike[]) =>
		Math.round(arr.reduce((a, w) => a + w.durationSec, 0) / 60);
	const sumDistKm = (arr: WorkoutLike[]) =>
		Math.round(arr.reduce((a, w) => a + (w.distanceM ?? 0), 0) / 100) / 10;

	const swimW = byType("SWIM");
	const bikeW = byType("BIKE");
	const runW = byType("RUN");
	const strengthW = byType("STRENGTH");

	const totalTSS = Math.round(thisWeek.reduce((a, w) => a + (w.tss ?? 0), 0));

	return {
		swim: { sessions: swimW.length, distanceKm: sumDistKm(swimW), durationMin: sumDurMin(swimW) },
		bike: { sessions: bikeW.length, distanceKm: sumDistKm(bikeW), durationMin: sumDurMin(bikeW) },
		run: { sessions: runW.length, distanceKm: sumDistKm(runW), durationMin: sumDurMin(runW) },
		strength: { sessions: strengthW.length, durationMin: sumDurMin(strengthW) },
		totalTSS,
		readinessScore: Math.min(100, Math.max(0, 100 - Math.round(totalTSS / 5))),
	};
}

// ── Chart Data ────────────────────────────────────────────────

/** Compute 7-day stacked chart data (Mon–Sun) for the current week. */
export function computeChartData(workouts: WorkoutLike[]): ChartDataPoint[] {
	const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	const now = new Date();
	const startOfWeek = new Date(now);
	const dayOfWeek = now.getDay() || 7;
	startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
	startOfWeek.setHours(0, 0, 0, 0);

	return days.map((day, i) => {
		const date = new Date(startOfWeek);
		date.setDate(startOfWeek.getDate() + i);
		const dayStr = toIsoDate(date);
		const dayWorkouts = workouts.filter((w) => w.startedAt.startsWith(dayStr));

		const minutesByType = (type: string) =>
			Math.round(
				dayWorkouts.filter((w) => w.activityType === type).reduce((a, w) => a + w.durationSec, 0) /
					60,
			);

		return {
			day,
			swim: minutesByType("SWIM"),
			bike: minutesByType("BIKE"),
			run: minutesByType("RUN"),
			strength: minutesByType("STRENGTH"),
		};
	});
}

// ── Health ─────────────────────────────────────────────────────

export type HealthSnapshot = {
	hrv: number;
	restingHr: number;
	sleepHours: number;
	sleepQuality: number;
	vo2max: number;
	weightKg: number;
	readinessScore: number;
};

export const DEFAULT_HEALTH_SNAPSHOT: HealthSnapshot = {
	hrv: 0,
	restingHr: 0,
	sleepHours: 0,
	sleepQuality: 0,
	vo2max: 0,
	weightKg: 0,
	readinessScore: 0,
};

/** Compute readiness score from sleep quality, mood, and HRV. */
export function computeReadinessScore(sleepQuality: number, mood: number, hrv: number): number {
	return Math.min(100, Math.round((sleepQuality * 10 + mood * 5 + (hrv > 0 ? 30 : 0)) / 1.4));
}

// ── Muscle Fatigue ─────────────────────────────────────────────

export type FatigueLevel = "low" | "moderate" | "high";

export type MuscleFatigue = {
	muscle: string;
	bodyPart: string;
	level: number; // 0–100
	status: FatigueLevel;
};

export const DEFAULT_MUSCLE_GROUPS: MuscleFatigue[] = [
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

/** Severity number → fatigue level label. */
export function severityToFatigueLevel(severity: number): FatigueLevel {
	if (severity >= 70) return "high";
	if (severity >= 40) return "moderate";
	return "low";
}

/** Merge active injuries into default muscle groups. */
export function mergeInjuriesToMuscleGroups(
	injuries: Array<{ body_part: string | null; severity: number | null }>,
): MuscleFatigue[] {
	const injuryMap = new Map<string, MuscleFatigue>();

	for (const inj of injuries) {
		const severity = inj.severity ?? 50;
		const bodyPart = inj.body_part ?? "";
		injuryMap.set(bodyPart, {
			muscle: bodyPart || "Unknown",
			bodyPart,
			level: severity,
			status: severityToFatigueLevel(severity),
		});
	}

	// Merge: default groups with any injury overrides
	const merged = DEFAULT_MUSCLE_GROUPS.map((def) => {
		const override = injuryMap.get(def.bodyPart);
		return override ?? def;
	});

	// Add injuries that don't match a default group
	for (const [bodyPart, data] of injuryMap) {
		if (!DEFAULT_MUSCLE_GROUPS.some((d) => d.bodyPart === bodyPart)) {
			merged.push(data);
		}
	}

	return merged;
}
