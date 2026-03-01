import { describe, expect, it } from "vitest";
import {
	computeAverageRPE,
	computeSessionVolume,
	computeVolume,
	type ExerciseData,
	estimate1RM,
	findTopSet,
	type SetData,
	summarizeStrengthWorkout,
} from "../strength/index";

describe("estimate1RM", () => {
	it("returns identity for 1 rep", () => {
		expect(estimate1RM(100, 1)).toBe(100);
	});

	it("returns null for zero weight", () => {
		expect(estimate1RM(0, 5)).toBeNull();
	});

	it("returns null for zero reps", () => {
		expect(estimate1RM(100, 0)).toBeNull();
	});

	it("returns null for negative weight", () => {
		expect(estimate1RM(-50, 5)).toBeNull();
	});

	it("uses Brzycki for 1-6 reps", () => {
		// Brzycki: 100 / (1.0278 - 0.0278 * 5) = 100 / 0.8888 ≈ 112.5
		const result = estimate1RM(100, 5)!;
		expect(result).toBeGreaterThan(112);
		expect(result).toBeLessThan(113);
	});

	it("uses Epley for 7-10 reps", () => {
		// Epley: 80 * (1 + 8/30) = 80 * 1.2667 ≈ 101.3
		const result = estimate1RM(80, 8)!;
		expect(result).toBeGreaterThan(101);
		expect(result).toBeLessThan(102);
	});

	it("uses Lombardi for >10 reps", () => {
		// Lombardi: 60 * 12^0.10
		const result = estimate1RM(60, 12)!;
		expect(result).toBeGreaterThan(60);
		expect(result).toBeLessThan(80);
	});

	it("returns results rounded to 1 decimal", () => {
		const result = estimate1RM(100, 5)!;
		expect(result.toString()).toMatch(/^\d+\.?\d?$/);
	});
});

describe("computeVolume", () => {
	it("sums weight * reps for working sets", () => {
		const sets: SetData[] = [
			{ reps: 5, weight_kg: 100, set_type: "working" },
			{ reps: 5, weight_kg: 100, set_type: "working" },
			{ reps: 5, weight_kg: 100, set_type: "working" },
		];
		expect(computeVolume(sets)).toBe(1500);
	});

	it("excludes warmup sets", () => {
		const sets: SetData[] = [
			{ reps: 10, weight_kg: 60, set_type: "warmup" },
			{ reps: 5, weight_kg: 100, set_type: "working" },
		];
		expect(computeVolume(sets)).toBe(500);
	});

	it("includes sets with no set_type (defaults to working)", () => {
		const sets: SetData[] = [
			{ reps: 8, weight_kg: 80 },
			{ reps: 8, weight_kg: 80 },
		];
		expect(computeVolume(sets)).toBe(1280);
	});

	it("returns 0 for empty array", () => {
		expect(computeVolume([])).toBe(0);
	});
});

describe("findTopSet", () => {
	it("finds the set with highest e1RM", () => {
		const sets: SetData[] = [
			{ reps: 5, weight_kg: 100, set_type: "working" },
			{ reps: 3, weight_kg: 110, set_type: "working" },
			{ reps: 8, weight_kg: 85, set_type: "working" },
		];
		const top = findTopSet(sets);
		expect(top).not.toBeNull();
		expect(top?.weight_kg).toBe(110);
	});

	it("excludes warmup sets", () => {
		const sets: SetData[] = [
			{ reps: 1, weight_kg: 140, set_type: "warmup" },
			{ reps: 5, weight_kg: 100, set_type: "working" },
		];
		const top = findTopSet(sets);
		expect(top?.weight_kg).toBe(100);
	});

	it("returns null for empty array", () => {
		expect(findTopSet([])).toBeNull();
	});

	it("returns null when all sets are warmups", () => {
		const sets: SetData[] = [{ reps: 10, weight_kg: 40, set_type: "warmup" }];
		expect(findTopSet(sets)).toBeNull();
	});
});

describe("summarizeStrengthWorkout", () => {
	it("summarizes a workout with exercises", () => {
		const rawData = {
			exercises: [
				{
					name: "Squat",
					sets: [
						{ reps: 5, weight_kg: 100, set_type: "working" as const },
						{ reps: 5, weight_kg: 100, set_type: "working" as const },
					],
				},
			],
		};

		const summary = summarizeStrengthWorkout(rawData);
		expect(summary).toHaveLength(1);
		expect(summary[0].name).toBe("Squat");
		expect(summary[0].workingSets).toBe(2);
		expect(summary[0].totalVolume_kg).toBe(1000);
		expect(summary[0].estimated1RM_kg).not.toBeNull();
	});

	it("returns empty array for null input", () => {
		expect(summarizeStrengthWorkout(null)).toEqual([]);
	});

	it("returns empty array for non-object input", () => {
		expect(summarizeStrengthWorkout("string")).toEqual([]);
	});

	it("returns empty array when exercises is missing", () => {
		expect(summarizeStrengthWorkout({ other: "data" })).toEqual([]);
	});

	it("includes group info for supersets", () => {
		const rawData = {
			exercises: [
				{
					name: "Bench Press",
					sets: [{ reps: 8, weight_kg: 80, set_type: "working" as const }],
					group_id: 1,
					group_type: "superset" as const,
				},
			],
		};

		const summary = summarizeStrengthWorkout(rawData);
		expect(summary[0].group_id).toBe(1);
		expect(summary[0].group_type).toBe("superset");
	});
});

describe("computeAverageRPE", () => {
	it("computes average RPE from working sets", () => {
		const exercises: ExerciseData[] = [
			{
				name: "Squat",
				sets: [
					{ reps: 5, weight_kg: 100, rpe: 8, set_type: "working" },
					{ reps: 5, weight_kg: 100, rpe: 9, set_type: "working" },
				],
			},
		];
		expect(computeAverageRPE(exercises)).toBe(8.5);
	});

	it("excludes warmup sets from RPE calculation", () => {
		const exercises: ExerciseData[] = [
			{
				name: "Squat",
				sets: [
					{ reps: 10, weight_kg: 40, rpe: 3, set_type: "warmup" },
					{ reps: 5, weight_kg: 100, rpe: 8, set_type: "working" },
				],
			},
		];
		expect(computeAverageRPE(exercises)).toBe(8);
	});

	it("returns null when no RPE values", () => {
		const exercises: ExerciseData[] = [
			{
				name: "Squat",
				sets: [{ reps: 5, weight_kg: 100, set_type: "working" }],
			},
		];
		expect(computeAverageRPE(exercises)).toBeNull();
	});
});

describe("computeSessionVolume", () => {
	it("sums volume across all exercises", () => {
		const exercises: ExerciseData[] = [
			{
				name: "Squat",
				sets: [
					{ reps: 5, weight_kg: 100, set_type: "working" },
					{ reps: 5, weight_kg: 100, set_type: "working" },
				],
			},
			{
				name: "Bench",
				sets: [{ reps: 8, weight_kg: 80, set_type: "working" }],
			},
		];
		// Squat: 500 + 500 = 1000, Bench: 640, Total: 1640
		expect(computeSessionVolume(exercises)).toBe(1640);
	});
});
