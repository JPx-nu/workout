import { describe, expect, it } from "vitest";
import {
	ChatMessageInput,
	DailyLogInput,
	InjuryInput,
	PlannedWorkoutInput,
	PlannedWorkoutUpdate,
	ProfileUpdate,
	WorkoutInput,
} from "../validation.js";

describe("ChatMessageInput", () => {
	it("accepts valid message", () => {
		const result = ChatMessageInput.safeParse({
			message: "How should I train today?",
		});
		expect(result.success).toBe(true);
	});

	it("accepts message with conversationId", () => {
		const result = ChatMessageInput.safeParse({
			message: "Hello",
			conversationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty message", () => {
		const result = ChatMessageInput.safeParse({ message: "" });
		expect(result.success).toBe(false);
	});

	it("rejects message over 4000 chars", () => {
		const result = ChatMessageInput.safeParse({
			message: "a".repeat(4001),
		});
		expect(result.success).toBe(false);
	});

	it("strips HTML from message", () => {
		const result = ChatMessageInput.safeParse({
			message: "Hello <script>alert('xss')</script>world",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.message).not.toContain("<script>");
			expect(result.data.message).toContain("Hello");
			expect(result.data.message).toContain("world");
		}
	});

	it("rejects invalid conversationId", () => {
		const result = ChatMessageInput.safeParse({
			message: "Hello",
			conversationId: "not-a-uuid",
		});
		expect(result.success).toBe(false);
	});

	it("accepts imageUrls array", () => {
		const result = ChatMessageInput.safeParse({
			message: "Check this photo",
			imageUrls: ["https://example.com/photo.jpg"],
		});
		expect(result.success).toBe(true);
	});

	it("rejects more than 3 imageUrls", () => {
		const result = ChatMessageInput.safeParse({
			message: "Photos",
			imageUrls: [
				"https://a.com/1.jpg",
				"https://a.com/2.jpg",
				"https://a.com/3.jpg",
				"https://a.com/4.jpg",
			],
		});
		expect(result.success).toBe(false);
	});
});

describe("WorkoutInput", () => {
	const validWorkout = {
		activity_type: "RUN",
		source: "MANUAL",
		started_at: "2026-02-28T10:00:00Z",
		duration_s: 3600,
		distance_m: 10000,
	};

	it("accepts valid workout", () => {
		const result = WorkoutInput.safeParse(validWorkout);
		expect(result.success).toBe(true);
	});

	it("rejects invalid activity type", () => {
		const result = WorkoutInput.safeParse({
			...validWorkout,
			activity_type: "HIKING",
		});
		expect(result.success).toBe(false);
	});

	it("rejects negative duration", () => {
		const result = WorkoutInput.safeParse({
			...validWorkout,
			duration_s: -10,
		});
		expect(result.success).toBe(false);
	});

	it("rejects heart rate out of range", () => {
		expect(WorkoutInput.safeParse({ ...validWorkout, avg_hr: 20 }).success).toBe(false);
		expect(WorkoutInput.safeParse({ ...validWorkout, avg_hr: 260 }).success).toBe(false);
	});

	it("accepts heart rate in valid range", () => {
		expect(WorkoutInput.safeParse({ ...validWorkout, avg_hr: 145 }).success).toBe(true);
	});

	it("accepts optional fields as undefined", () => {
		const result = WorkoutInput.safeParse({
			activity_type: "SWIM",
			source: "GARMIN",
			started_at: "2026-02-28T08:00:00Z",
			duration_s: 1800,
			distance_m: 1500,
		});
		expect(result.success).toBe(true);
	});
});

describe("DailyLogInput", () => {
	it("accepts valid daily log", () => {
		const result = DailyLogInput.safeParse({
			log_date: "2026-02-28",
			sleep_hours: 7.5,
			mood: 7,
			rpe: 5,
		});
		expect(result.success).toBe(true);
	});

	it("rejects sleep hours over 24", () => {
		const result = DailyLogInput.safeParse({
			log_date: "2026-02-28",
			sleep_hours: 25,
		});
		expect(result.success).toBe(false);
	});

	it("rejects mood out of 1-10 range", () => {
		expect(DailyLogInput.safeParse({ log_date: "2026-02-28", mood: 0 }).success).toBe(false);
		expect(DailyLogInput.safeParse({ log_date: "2026-02-28", mood: 11 }).success).toBe(false);
	});

	it("accepts minimal daily log (date only)", () => {
		const result = DailyLogInput.safeParse({
			log_date: "2026-02-28",
		});
		expect(result.success).toBe(true);
	});

	it("strips HTML from notes", () => {
		const result = DailyLogInput.safeParse({
			log_date: "2026-02-28",
			notes: "Felt good <b>today</b>",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.notes).not.toContain("<b>");
		}
	});
});

describe("InjuryInput", () => {
	it("accepts valid injury", () => {
		const result = InjuryInput.safeParse({
			body_part: "left knee",
			severity: 3,
		});
		expect(result.success).toBe(true);
	});

	it("rejects severity out of 1-5 range", () => {
		expect(InjuryInput.safeParse({ body_part: "knee", severity: 0 }).success).toBe(false);
		expect(InjuryInput.safeParse({ body_part: "knee", severity: 6 }).success).toBe(false);
	});

	it("rejects empty body part", () => {
		const result = InjuryInput.safeParse({
			body_part: "",
			severity: 2,
		});
		expect(result.success).toBe(false);
	});
});

describe("ProfileUpdate", () => {
	it("accepts valid profile update", () => {
		const result = ProfileUpdate.safeParse({
			display_name: "Johan",
			timezone: "Europe/Stockholm",
		});
		expect(result.success).toBe(true);
	});

	it("rejects display name over 100 chars", () => {
		const result = ProfileUpdate.safeParse({
			display_name: "a".repeat(101),
		});
		expect(result.success).toBe(false);
	});

	it("accepts empty object (all fields optional)", () => {
		const result = ProfileUpdate.safeParse({});
		expect(result.success).toBe(true);
	});
});

describe("PlannedWorkoutInput", () => {
	const validPlanned = {
		plannedDate: "2026-03-01",
		activityType: "RUN",
		title: "Easy recovery run",
	};

	it("accepts valid planned workout", () => {
		const result = PlannedWorkoutInput.safeParse(validPlanned);
		expect(result.success).toBe(true);
	});

	it("rejects invalid date format", () => {
		const result = PlannedWorkoutInput.safeParse({
			...validPlanned,
			plannedDate: "March 1, 2026",
		});
		expect(result.success).toBe(false);
	});

	it("rejects missing title", () => {
		const result = PlannedWorkoutInput.safeParse({
			plannedDate: "2026-03-01",
			activityType: "RUN",
		});
		expect(result.success).toBe(false);
	});

	it("accepts all optional fields", () => {
		const result = PlannedWorkoutInput.safeParse({
			...validPlanned,
			durationMin: 45,
			distanceKm: 8,
			intensity: "EASY",
			targetRpe: 4,
			notes: "Keep it easy",
			source: "AI",
		});
		expect(result.success).toBe(true);
	});

	it("rejects RPE out of 1-10 range", () => {
		expect(PlannedWorkoutInput.safeParse({ ...validPlanned, targetRpe: 0 }).success).toBe(false);
		expect(PlannedWorkoutInput.safeParse({ ...validPlanned, targetRpe: 11 }).success).toBe(false);
	});
});

describe("PlannedWorkoutUpdate", () => {
	it("accepts partial update (just status)", () => {
		const result = PlannedWorkoutUpdate.safeParse({
			status: "completed",
		});
		expect(result.success).toBe(true);
	});

	it("accepts empty object", () => {
		const result = PlannedWorkoutUpdate.safeParse({});
		expect(result.success).toBe(true);
	});

	it("accepts date change for drag-drop", () => {
		const result = PlannedWorkoutUpdate.safeParse({
			plannedDate: "2026-03-05",
		});
		expect(result.success).toBe(true);
	});
});
