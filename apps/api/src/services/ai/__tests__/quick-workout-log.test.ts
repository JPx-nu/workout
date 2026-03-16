import { describe, expect, it, vi } from "vitest";
import { parseQuickWorkoutLogRequest } from "../quick-workout-log.js";

describe("parseQuickWorkoutLogRequest", () => {
	it("parses a simple completed run log request", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-16T10:00:00Z"));

		const parsed = parseQuickWorkoutLogRequest("log a 30 minute 5km run from yesterday");

		expect(parsed).toMatchObject({
			activityType: "RUN",
			durationMin: 30,
			distanceKm: 5,
		});
		expect(parsed?.startedAt.startsWith("2026-03-15")).toBe(true);
		expect(parsed?.summary).toContain("30-minute");
		expect(parsed?.summary).toContain("5 km");
		expect(parsed?.summary).toContain("run");
		expect(parsed?.summary).toContain("yesterday");

		vi.useRealTimers();
	});

	it("does not parse general training chat as a write request", () => {
		const parsed = parseQuickWorkoutLogRequest("should I do a 30 minute run tomorrow?");
		expect(parsed).toBeNull();
	});

	it("does not hijack future scheduling requests", () => {
		const parsed = parseQuickWorkoutLogRequest("log a 30 minute run tomorrow");
		expect(parsed).toBeNull();
	});

	it("parses optional metrics when present", () => {
		const parsed = parseQuickWorkoutLogRequest(
			"record a 45 min bike ride today avg hr 142 and 55 tss",
			{
				now: new Date("2026-03-16T12:00:00Z"),
			},
		);

		expect(parsed).toMatchObject({
			activityType: "BIKE",
			durationMin: 45,
			avgHr: 142,
			tss: 55,
		});
	});
});
