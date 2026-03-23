import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createUserClientMock = vi.hoisted(() => vi.fn());

vi.mock("../services/ai/supabase.js", () => ({
	createUserClient: createUserClientMock,
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
	getJwt: () => "jwt-token",
}));

import { plannedWorkoutsRoutes } from "../routes/planned-workouts/index.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/planned-workouts", plannedWorkoutsRoutes);
	return app;
}

function createPlannedWorkoutsAdminClient() {
	const insertedRows: Array<Array<Record<string, unknown>>> = [];

	const client = {
		from(table: string) {
			if (table !== "planned_workouts") {
				throw new Error(`Unexpected table: ${table}`);
			}

			return {
				insert(rows: Record<string, unknown> | Array<Record<string, unknown>>) {
					const normalizedRows = Array.isArray(rows) ? rows : [rows];
					insertedRows.push(normalizedRows);
					return {
						select() {
							const batchResult = Promise.resolve({
								data: normalizedRows.map((row, index) => ({
									...row,
									id: `planned-${index + 1}`,
									workout_id: null,
									created_at: "2026-03-17T08:00:00.000Z",
									updated_at: "2026-03-17T08:00:00.000Z",
								})),
								error: null,
							});

							return Object.assign(batchResult, {
								single() {
									const row = normalizedRows[0];
									return Promise.resolve({
										data: {
											...row,
											id: "planned-1",
											workout_id: null,
											created_at: "2026-03-17T08:00:00.000Z",
											updated_at: "2026-03-17T08:00:00.000Z",
										},
										error: null,
									});
								},
							});
						},
					};
				},
			};
		},
	};

	return { client, insertedRows };
}

const scheduledStrengthSession = {
	schemaVersion: 1,
	activityType: "STRENGTH" as const,
	mode: "schedule" as const,
	status: "planned" as const,
	source: "MANUAL" as const,
	plannedDate: "2026-03-20",
	plannedTime: "07:00",
	durationSec: 3600,
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
					weightKg: 95,
					rpe: 7,
				},
			],
		},
	],
};

describe("plannedWorkoutsRoutes", () => {
	beforeEach(() => {
		createUserClientMock.mockReset();
	});

	it("creates a single in-progress strength draft through the shared planned-workout path", async () => {
		const { client, insertedRows } = createPlannedWorkoutsAdminClient();
		createUserClientMock.mockReturnValue(client);
		const app = createAuthedApp();

		const response = await app.request("/api/planned-workouts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				plannedDate: "2026-03-20",
				plannedTime: "07:00",
				activityType: "STRENGTH",
				title: "Lower body session",
				durationMin: 60,
				status: "in_progress",
				sessionData: {
					...scheduledStrengthSession,
					mode: "start_now",
					status: "in_progress",
				},
			}),
		});

		expect(response.status).toBe(201);
		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0][0]).toMatchObject({
			athlete_id: "athlete-1",
			club_id: "club-1",
			activity_type: "STRENGTH",
			status: "in_progress",
			session_data: expect.objectContaining({
				schemaVersion: 1,
				mode: "start_now",
				status: "in_progress",
			}),
		});
	});

	it("batch schedules future sessions using the shared canonical session payload", async () => {
		const { client, insertedRows } = createPlannedWorkoutsAdminClient();
		createUserClientMock.mockReturnValue(client);
		const app = createAuthedApp();

		const response = await app.request("/api/planned-workouts/batch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				workouts: [
					{
						plannedDate: "2026-03-20",
						plannedTime: "07:00",
						activityType: "STRENGTH",
						title: "Lower body session",
						durationMin: 60,
						sessionData: scheduledStrengthSession,
						source: "MANUAL",
					},
					{
						plannedDate: "2026-03-22",
						activityType: "RUN",
						title: "Easy aerobic run",
						durationMin: 40,
						intensity: "EASY",
						source: "MANUAL",
					},
				],
			}),
		});

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toMatchObject({
			data: [{ id: "planned-1" }, { id: "planned-2" }],
		});
		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toHaveLength(2);
		expect(insertedRows[0][0]).toMatchObject({
			athlete_id: "athlete-1",
			club_id: "club-1",
			activity_type: "STRENGTH",
			session_data: expect.objectContaining({
				schemaVersion: 1,
				activityType: "STRENGTH",
				mode: "schedule",
				status: "planned",
			}),
		});
		expect(insertedRows[0][1]).toMatchObject({
			activity_type: "RUN",
			title: "Easy aerobic run",
		});
	});
});
