import { afterEach, describe, expect, it, vi } from "vitest";
import { daysUntil, getWeekStart, lookbackDate, progressPercent, toIsoDate } from "../utils/dates";

afterEach(() => {
	vi.useRealTimers();
});

describe("daysUntil", () => {
	it("returns positive days for future date", () => {
		const future = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
		const result = daysUntil(future);
		expect(result).toBeGreaterThanOrEqual(6);
		expect(result).toBeLessThanOrEqual(8);
	});

	it("returns 0 for past date", () => {
		expect(daysUntil("2020-01-01")).toBe(0);
	});

	it("returns 0 for today", () => {
		const today = new Date().toISOString().split("T")[0];
		// Could be 0 or 1 depending on time of day
		expect(daysUntil(today)).toBeLessThanOrEqual(1);
	});
});

describe("toIsoDate", () => {
	it("formats date as YYYY-MM-DD", () => {
		const result = toIsoDate(new Date("2026-03-15T14:30:00Z"));
		expect(result).toBe("2026-03-15");
	});

	it("defaults to today", () => {
		const result = toIsoDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("getWeekStart", () => {
	it("returns Monday at 00:00:00", () => {
		// Wednesday, March 4, 2026
		const wed = new Date("2026-03-04T15:30:00Z");
		const monday = getWeekStart(wed);
		expect(monday.getDay()).toBe(1); // Monday
		expect(monday.getHours()).toBe(0);
		expect(monday.getMinutes()).toBe(0);
	});

	it("returns same day if already Monday", () => {
		// Monday, March 2, 2026
		const mon = new Date("2026-03-02T10:00:00Z");
		const result = getWeekStart(mon);
		expect(result.getDay()).toBe(1);
		expect(result.getDate()).toBe(mon.getDate());
	});

	it("handles Sunday (goes back to Monday)", () => {
		// Sunday, March 8, 2026
		const sun = new Date("2026-03-08T12:00:00Z");
		const result = getWeekStart(sun);
		expect(result.getDay()).toBe(1); // Monday
	});
});

describe("lookbackDate", () => {
	it("returns ISO date N days ago", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-01T12:00:00Z"));

		expect(lookbackDate(7)).toBe("2026-02-22");
		expect(lookbackDate(14)).toBe("2026-02-15");
		expect(lookbackDate(0)).toBe("2026-03-01");

		vi.useRealTimers();
	});
});

describe("progressPercent", () => {
	it("computes percentage", () => {
		expect(progressPercent(3, 10)).toBe(30);
		expect(progressPercent(10, 10)).toBe(100);
	});

	it("returns 0 for zero total", () => {
		expect(progressPercent(5, 0)).toBe(0);
	});

	it("clamps at 100", () => {
		expect(progressPercent(15, 10)).toBe(100);
	});

	it("returns 0 for negative total", () => {
		expect(progressPercent(5, -1)).toBe(0);
	});
});
