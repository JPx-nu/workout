import { describe, expect, it } from "vitest";
import { formatDuration, formatPace, mToKm, secToMin } from "../utils/formatters.js";

describe("secToMin", () => {
	it("converts seconds to minutes (rounded)", () => {
		expect(secToMin(3600)).toBe(60);
		expect(secToMin(90)).toBe(2);
		expect(secToMin(89)).toBe(1);
		expect(secToMin(0)).toBe(0);
	});
});

describe("mToKm", () => {
	it("converts meters to km with 1 decimal", () => {
		expect(mToKm(10000)).toBe(10);
		expect(mToKm(5500)).toBe(5.5);
		expect(mToKm(1234)).toBe(1.2);
		expect(mToKm(0)).toBe(0);
	});
});

describe("formatDuration", () => {
	it("formats minutes only for < 1 hour", () => {
		expect(formatDuration(2700)).toBe("45m");
		expect(formatDuration(600)).toBe("10m");
	});

	it("formats hours and minutes for >= 1 hour", () => {
		expect(formatDuration(3600)).toBe("1h 0m");
		expect(formatDuration(5400)).toBe("1h 30m");
		expect(formatDuration(7200)).toBe("2h 0m");
	});

	it("handles zero seconds", () => {
		expect(formatDuration(0)).toBe("0m");
	});
});

describe("formatPace", () => {
	it("formats pace as min:sec/km", () => {
		// 30 min for 5km = 6:00/km
		expect(formatPace(1800, 5000)).toBe("6:00/km");
	});

	it("pads seconds with leading zero", () => {
		// 25:05 for 5km = 5:01/km
		expect(formatPace(1505, 5000)).toBe("5:01/km");
	});

	it("returns dash for zero distance", () => {
		expect(formatPace(1800, 0)).toBe("\u2014");
	});
});
