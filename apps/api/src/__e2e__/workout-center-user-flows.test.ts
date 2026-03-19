import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredWorkout = {
	id: string;
	athlete_id: string;
	club_id: string;
	activity_type: string;
	source: string;
	started_at: string;
	duration_s: number | null;
	distance_m: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	avg_pace_s_km: number | null;
	avg_power_w: number | null;
	calories: number | null;
	tss: number | null;
	raw_data: Record<string, unknown> | null;
	notes: string | null;
};

type StoredPlannedWorkout = {
	id: string;
	athlete_id: string;
	club_id: string;
	plan_id: string | null;
	planned_date: string;
	planned_time: string | null;
	activity_type: string;
	title: string;
	description: string | null;
	duration_min: number | null;
	distance_km: number | null;
	target_tss: number | null;
	target_rpe: number | null;
	intensity: string | null;
	session_data: Record<string, unknown> | null;
	status: string;
	sort_order: number;
	notes: string | null;
	coach_notes: string | null;
	source: string;
	workout_id: string | null;
	created_at: string;
	updated_at: string;
};

type Filter = { column: string; value: unknown };

const workoutCenterState = vi.hoisted(() => ({
	workoutCounter: 0,
	plannedCounter: 0,
	workouts: [] as StoredWorkout[],
	plannedWorkouts: [] as StoredPlannedWorkout[],
}));

function createTestUuid(counter: number): string {
	return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

function resetWorkoutCenterState() {
	workoutCenterState.workoutCounter = 0;
	workoutCenterState.plannedCounter = 0;
	workoutCenterState.workouts = [];
	workoutCenterState.plannedWorkouts = [];
}

function matchesFilters(row: Record<string, unknown>, filters: Filter[]): boolean {
	return filters.every((filter) => row[filter.column] === filter.value);
}

function createWorkoutCenterAdminClient() {
	return {
		from(table: string) {
			if (table === "workouts") {
				return {
					insert(row: Record<string, unknown>) {
						const created: StoredWorkout = {
							id: createTestUuid(++workoutCenterState.workoutCounter + 100),
							athlete_id: String(row.athlete_id),
							club_id: String(row.club_id),
							activity_type: String(row.activity_type),
							source: String(row.source),
							started_at: String(row.started_at),
							duration_s: typeof row.duration_s === "number" ? row.duration_s : null,
							distance_m: typeof row.distance_m === "number" ? row.distance_m : null,
							avg_hr: typeof row.avg_hr === "number" ? row.avg_hr : null,
							max_hr: typeof row.max_hr === "number" ? row.max_hr : null,
							avg_pace_s_km: typeof row.avg_pace_s_km === "number" ? row.avg_pace_s_km : null,
							avg_power_w: typeof row.avg_power_w === "number" ? row.avg_power_w : null,
							calories: typeof row.calories === "number" ? row.calories : null,
							tss: typeof row.tss === "number" ? row.tss : null,
							raw_data:
								row.raw_data && typeof row.raw_data === "object"
									? (row.raw_data as Record<string, unknown>)
									: null,
							notes: typeof row.notes === "string" ? row.notes : null,
						};
						workoutCenterState.workouts.push(created);

						return {
							select() {
								return {
									single() {
										return Promise.resolve({
											data: created,
											error: null,
										});
									},
								};
							},
						};
					},
				};
			}

			if (table === "planned_workouts") {
				return {
					insert(row: Record<string, unknown> | Array<Record<string, unknown>>) {
						const rows = Array.isArray(row) ? row : [row];
						const createdRows = rows.map((item) => {
							const created: StoredPlannedWorkout = {
								id: createTestUuid(++workoutCenterState.plannedCounter),
								athlete_id: String(item.athlete_id),
								club_id: String(item.club_id),
								plan_id: typeof item.plan_id === "string" ? item.plan_id : null,
								planned_date: String(item.planned_date),
								planned_time: typeof item.planned_time === "string" ? item.planned_time : null,
								activity_type: String(item.activity_type),
								title: String(item.title),
								description: typeof item.description === "string" ? item.description : null,
								duration_min: typeof item.duration_min === "number" ? item.duration_min : null,
								distance_km: typeof item.distance_km === "number" ? item.distance_km : null,
								target_tss: typeof item.target_tss === "number" ? item.target_tss : null,
								target_rpe: typeof item.target_rpe === "number" ? item.target_rpe : null,
								intensity: typeof item.intensity === "string" ? item.intensity : null,
								session_data:
									item.session_data && typeof item.session_data === "object"
										? (item.session_data as Record<string, unknown>)
										: null,
								status: String(item.status),
								sort_order: typeof item.sort_order === "number" ? item.sort_order : 0,
								notes: typeof item.notes === "string" ? item.notes : null,
								coach_notes: typeof item.coach_notes === "string" ? item.coach_notes : null,
								source: typeof item.source === "string" ? item.source : "MANUAL",
								workout_id: typeof item.workout_id === "string" ? item.workout_id : null,
								created_at: "2026-03-18T09:00:00.000Z",
								updated_at: "2026-03-18T09:00:00.000Z",
							};
							workoutCenterState.plannedWorkouts.push(created);
							return created;
						});

						return {
							select() {
								const batchResult = Promise.resolve({
									data: createdRows,
									error: null,
								});

								return Object.assign(batchResult, {
									single() {
										return Promise.resolve({
											data: createdRows[0] ?? null,
											error: createdRows[0] ? null : { message: "No planned workout created" },
										});
									},
								});
							},
						};
					},
					update(updates: Record<string, unknown>) {
						const filters: Filter[] = [];

						const execute = () => {
							const matchingRows = workoutCenterState.plannedWorkouts.filter((row) =>
								matchesFilters(row as unknown as Record<string, unknown>, filters),
							);
							for (const row of matchingRows) {
								Object.assign(row, updates, { updated_at: "2026-03-18T09:05:00.000Z" });
							}

							return {
								data: matchingRows,
								error: null,
							};
						};

						const chainPromise = Promise.resolve().then(() => execute());
						const chain = {
							eq(column: string, value: unknown) {
								filters.push({ column, value });
								return chain;
							},
							select() {
								return {
									single() {
										return Promise.resolve().then(() => {
											const result = execute();
											return {
												data: result.data[0] ?? null,
												error: result.data[0] ? null : { message: "Planned workout not found" },
											};
										});
									},
								};
							},
						};

						return Object.assign(chainPromise, chain);
					},
				};
			}

			throw new Error(`Unexpected table: ${table}`);
		},
	};
}

vi.mock("../services/ai/supabase.js", () => ({
	createAdminClient: () => createWorkoutCenterAdminClient(),
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
}));

import { plannedWorkoutsRoutes } from "../routes/planned-workouts/index.js";
import { workoutsRoutes } from "../routes/workouts/index.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/planned-workouts", plannedWorkoutsRoutes);
	app.route("/api/workouts", workoutsRoutes);
	return app;
}

const strengthSession = {
	schemaVersion: 1,
	activityType: "STRENGTH" as const,
	mode: "start_now" as const,
	status: "in_progress" as const,
	source: "MANUAL" as const,
	plannedDate: "2026-03-20",
	plannedTime: "07:00",
	durationSec: 2700,
	sessionNotes: "Lower body emphasis",
	exercises: [
		{
			id: "exercise-1",
			displayName: "Barbell Back Squat",
			isCustom: false,
			equipment: "barbell" as const,
			movementPattern: "squat" as const,
			primaryMuscleGroups: ["quads" as const, "glutes" as const],
			sets: [
				{
					id: "set-1",
					order: 1,
					setType: "working" as const,
					completed: false,
					reps: 5,
					weightKg: 100,
					rpe: 8,
				},
			],
		},
	],
};

describe("Workout Center user flows", () => {
	beforeEach(() => {
		resetWorkoutCenterState();
	});

	it("logs a past strength workout into history", async () => {
		const app = createAuthedApp();

		const response = await app.request("/api/workouts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				activityType: "STRENGTH",
				startedAt: "2026-03-17T09:00:00.000Z",
				durationSec: 2700,
				notes: "Felt solid",
				strengthSession: {
					...strengthSession,
					mode: "log_past",
					status: "completed",
					startedAt: "2026-03-17T09:00:00.000Z",
				},
			}),
		});

		expect(response.status).toBe(201);
		expect(workoutCenterState.workouts).toHaveLength(1);
		expect(workoutCenterState.workouts[0]).toMatchObject({
			activity_type: "STRENGTH",
			notes: "Felt solid",
			raw_data: expect.objectContaining({
				mode: "log_past",
				status: "completed",
			}),
		});
	});

	it("starts a strength draft and finishes it into workout history with a linked planned session", async () => {
		const app = createAuthedApp();

		const draftResponse = await app.request("/api/planned-workouts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plannedDate: "2026-03-20",
				plannedTime: "07:00",
				activityType: "STRENGTH",
				title: "Lower body session",
				durationMin: 45,
				status: "in_progress",
				sessionData: strengthSession,
			}),
		});

		expect(draftResponse.status).toBe(201);
		const draftJson = (await draftResponse.json()) as { data: { id: string } };
		const draftId = draftJson.data.id;
		expect(workoutCenterState.plannedWorkouts).toHaveLength(1);
		expect(workoutCenterState.plannedWorkouts[0]?.status).toBe("in_progress");

		const finishResponse = await app.request("/api/workouts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				activityType: "STRENGTH",
				startedAt: "2026-03-20T07:00:00.000Z",
				durationSec: 2700,
				notes: "Finished strong",
				plannedWorkoutId: draftId,
				strengthSession: {
					...strengthSession,
					startedAt: "2026-03-20T07:00:00.000Z",
					status: "completed",
				},
			}),
		});

		expect(finishResponse.status).toBe(201);
		expect(workoutCenterState.workouts).toHaveLength(1);
		const completedWorkoutId = workoutCenterState.workouts[0]?.id;
		expect(workoutCenterState.plannedWorkouts[0]).toMatchObject({
			id: draftId,
			status: "completed",
			workout_id: completedWorkoutId,
			session_data: expect.objectContaining({
				status: "completed",
			}),
		});
	});

	it("batch schedules future sessions for the workout center calendar flow", async () => {
		const app = createAuthedApp();

		const response = await app.request("/api/planned-workouts/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workouts: [
					{
						plannedDate: "2026-03-22",
						plannedTime: "08:00",
						activityType: "STRENGTH",
						title: "Upper body session",
						durationMin: 50,
						sessionData: {
							...strengthSession,
							mode: "schedule",
							status: "planned",
							plannedDate: "2026-03-22",
							plannedTime: "08:00",
						},
					},
					{
						plannedDate: "2026-03-24",
						activityType: "RUN",
						title: "Easy run",
						durationMin: 40,
						intensity: "EASY",
					},
				],
			}),
		});

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toMatchObject({
			data: [
				expect.objectContaining({
					activity_type: "STRENGTH",
					status: "planned",
				}),
				expect.objectContaining({
					activity_type: "RUN",
					status: "planned",
				}),
			],
		});
		expect(workoutCenterState.plannedWorkouts).toHaveLength(2);
		expect(workoutCenterState.plannedWorkouts[0]).toMatchObject({
			title: "Upper body session",
			session_data: expect.objectContaining({
				activityType: "STRENGTH",
				mode: "schedule",
				status: "planned",
			}),
		});
		expect(workoutCenterState.plannedWorkouts[1]).toMatchObject({
			title: "Easy run",
			activity_type: "RUN",
			status: "planned",
		});
	});
});
