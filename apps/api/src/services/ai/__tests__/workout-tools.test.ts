import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createCompletedWorkoutMock = vi.hoisted(() => vi.fn());
const createPlannedWorkoutMock = vi.hoisted(() => vi.fn());
const scheduleSessionsBatchMock = vi.hoisted(() => vi.fn());
const structuredInvokeMock = vi.hoisted(() => vi.fn());

vi.mock("../../workout-center.js", async () => {
	const actual =
		await vi.importActual<typeof import("../../workout-center.js")>("../../workout-center.js");

	return {
		...actual,
		createCompletedWorkout: createCompletedWorkoutMock,
		createPlannedWorkout: createPlannedWorkoutMock,
		scheduleSessionsBatch: scheduleSessionsBatchMock,
	};
});

vi.mock("../../../config/ai.js", () => ({
	AI_CONFIG: {
		activityEmoji: {
			SWIM: "🏊",
			BIKE: "🚴",
			RUN: "🏃",
			STRENGTH: "💪",
			YOGA: "🧘",
			OTHER: "⚡",
		},
		azure: {
			apiKey: "test-key",
			deploymentName: "gpt-5-mini",
			apiVersion: "2024-12-01-preview",
		},
	},
	getAzureInstanceName: () => "test-instance",
}));

vi.mock("@langchain/openai", () => ({
	AzureChatOpenAI: vi.fn(function MockAzureChatOpenAI() {
		return {
			withStructuredOutput: () => ({
				invoke: structuredInvokeMock,
			}),
		};
	}),
}));

import { createGenerateWorkoutPlanTool } from "../tools/generate-workout-plan.js";
import { createLogWorkoutTool } from "../tools/log-workout.js";
import { createScheduleWorkoutTool } from "../tools/schedule-workout.js";

function createScheduleToolClient() {
	return {
		from(table: string) {
			if (table !== "training_plans") {
				throw new Error(`Unexpected table: ${table}`);
			}

			return {
				select() {
					return this;
				},
				eq() {
					return this;
				},
				order() {
					return this;
				},
				limit() {
					return this;
				},
				maybeSingle() {
					return Promise.resolve({ data: { id: "plan-1" }, error: null });
				},
			};
		},
	};
}

function createGeneratePlanClient() {
	return {
		from(table: string) {
			if (table === "profiles") {
				return {
					select() {
						return this;
					},
					eq() {
						return this;
					},
					single() {
						return Promise.resolve({
							data: { id: "athlete-1", display_name: "Athlete", timezone: "UTC", role: "athlete" },
							error: null,
						});
					},
				};
			}

			if (table === "workouts" || table === "daily_logs") {
				return {
					select() {
						return this;
					},
					eq() {
						return this;
					},
					order() {
						return this;
					},
					limit() {
						return Promise.resolve({ data: [], error: null });
					},
				};
			}

			if (table === "injuries") {
				return {
					select() {
						return this;
					},
					eq() {
						return this;
					},
					is() {
						return Promise.resolve({ data: [], error: null });
					},
				};
			}

			if (table === "training_plans") {
				return {
					insert() {
						return {
							select() {
								return {
									single() {
										return Promise.resolve({ data: { id: "plan-1" }, error: null });
									},
								};
							},
						};
					},
				};
			}

			throw new Error(`Unexpected table: ${table}`);
		},
	};
}

describe("AI workout creation tools", () => {
	beforeEach(() => {
		createCompletedWorkoutMock.mockReset();
		createPlannedWorkoutMock.mockReset();
		scheduleSessionsBatchMock.mockReset();
		structuredInvokeMock.mockReset();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-17T10:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("log_workout persists strength sessions through the shared completed-workout service", async () => {
		createCompletedWorkoutMock.mockResolvedValue({
			id: "workout-1",
			activity_type: "STRENGTH",
			started_at: "2026-03-16T09:00:00.000Z",
		});

		const tool = createLogWorkoutTool({} as never, "athlete-1", "club-1");
		const response = await tool.invoke({
			activityType: "STRENGTH",
			startedAt: "2026-03-16T09:00:00.000Z",
			durationMin: 45,
			notes: "Leg day",
			exercises: [
				{
					name: "Barbell Back Squat",
					sets: [
						{ reps: 5, weight_kg: 100, rpe: 8 },
						{ reps: 5, weight_kg: 100, rpe: 8.5 },
					],
				},
			],
		});

		expect(typeof response).toBe("string");
		expect(createCompletedWorkoutMock).toHaveBeenCalledTimes(1);
		expect(createCompletedWorkoutMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				athleteId: "athlete-1",
				clubId: "club-1",
				activityType: "STRENGTH",
				notes: "Leg day",
				strengthSession: expect.objectContaining({
					schemaVersion: 1,
					activityType: "STRENGTH",
					mode: "log_past",
					status: "completed",
					source: "COACH",
					exercises: [
						expect.objectContaining({
							displayName: "Barbell Back Squat",
							sets: [
								expect.objectContaining({ reps: 5, weightKg: 100, rpe: 8 }),
								expect.objectContaining({ reps: 5, weightKg: 100, rpe: 8.5 }),
							],
						}),
					],
				}),
			}),
		);
	});

	it("schedule_workout persists strength sessions through the shared planned-workout service", async () => {
		createPlannedWorkoutMock.mockResolvedValue({ id: "planned-1" });

		const tool = createScheduleWorkoutTool(
			createScheduleToolClient() as never,
			"athlete-1",
			"club-1",
		);
		const response = await tool.invoke({
			plannedDate: "2026-03-20",
			plannedTime: "07:00",
			activityType: "STRENGTH",
			title: "Lower body session",
			durationMin: 60,
			notes: "Keep it crisp",
			exercises: [
				{
					name: "Barbell Back Squat",
					sets: [{ reps: 5, weight_kg: 95, rpe: 7.5 }],
				},
			],
		});

		expect(response).toContain('Scheduled "Lower body session"');
		expect(createPlannedWorkoutMock).toHaveBeenCalledTimes(1);
		expect(createPlannedWorkoutMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				athleteId: "athlete-1",
				clubId: "club-1",
				planId: "plan-1",
				source: "AI",
				sessionData: expect.objectContaining({
					schemaVersion: 1,
					activityType: "STRENGTH",
					mode: "schedule",
					status: "planned",
					source: "AI",
				}),
			}),
		);
	});

	it("generate_workout_plan creates scheduled sessions through the shared batch service", async () => {
		structuredInvokeMock.mockResolvedValue({
			name: "10k Builder",
			goal: "Run a faster 10k",
			weeks: [
				{
					weekNumber: 1,
					theme: "Base",
					sessions: [
						{
							dayOffset: 0,
							activityType: "RUN",
							title: "Easy run",
							description: "Zone 2 aerobic run",
							durationMin: 40,
							intensity: "EASY",
							targetRpe: 4,
						},
						{
							dayOffset: 2,
							activityType: "STRENGTH",
							title: "Strength support",
							description: "Compound full-body session",
							durationMin: 45,
							intensity: "MODERATE",
							targetRpe: 6,
						},
					],
				},
			],
		});
		scheduleSessionsBatchMock.mockResolvedValue([{ id: "planned-1" }, { id: "planned-2" }]);

		const tool = createGenerateWorkoutPlanTool(
			createGeneratePlanClient() as never,
			"athlete-1",
			"club-1",
		);
		const response = await tool.invoke({
			goal: "Run a faster 10k",
			durationWeeks: 1,
			weeklyAvailability: 2,
			focusActivities: ["RUN", "STRENGTH"],
		});

		expect(response).toContain('Created "10k Builder"');
		expect(scheduleSessionsBatchMock).toHaveBeenCalledTimes(1);
		expect(scheduleSessionsBatchMock).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				athleteId: "athlete-1",
				clubId: "club-1",
				workouts: [
					expect.objectContaining({
						planId: "plan-1",
						plannedDate: expect.any(String),
						activityType: "RUN",
						source: "AI",
						status: "planned",
					}),
					expect.objectContaining({
						planId: "plan-1",
						activityType: "STRENGTH",
						source: "AI",
						status: "planned",
					}),
				],
			}),
		);
	});
});
