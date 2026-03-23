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

import { workoutsRoutes } from "../routes/workouts/index.js";

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/workouts", workoutsRoutes);
	return app;
}

function createWorkoutsAdminClient() {
	const insertedRows: Array<Record<string, unknown>> = [];
	const updatedRows: Array<Record<string, unknown>> = [];

	const client = {
		from(table: string) {
			if (table !== "workouts") {
				throw new Error(`Unexpected table: ${table}`);
			}

			return {
				insert(row: Record<string, unknown>) {
					insertedRows.push(row);
					return {
						select() {
							return {
								single() {
									return Promise.resolve({
										data: {
											id: "workout-1",
											activity_type: row.activity_type,
											started_at: row.started_at,
											raw_data: row.raw_data,
										},
										error: null,
									});
								},
							};
						},
					};
				},
				update(row: Record<string, unknown>) {
					updatedRows.push(row);
					const chain = {
						eq() {
							return chain;
						},
						select() {
							return {
								single() {
									return Promise.resolve({
										data: {
											id: "workout-1",
											activity_type: "STRENGTH",
											started_at: "2026-03-17T09:00:00.000Z",
											raw_data: row.raw_data ?? null,
										},
										error: null,
									});
								},
							};
						},
					};
					return chain;
				},
			};
		},
	};

	return { client, insertedRows, updatedRows };
}

const strengthSession = {
	schemaVersion: 1,
	activityType: "STRENGTH" as const,
	mode: "log_past" as const,
	status: "completed" as const,
	source: "MANUAL" as const,
	startedAt: "2026-03-17T09:00:00.000Z",
	durationSec: 2700,
	sessionNotes: "Felt strong",
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
					completed: true,
					reps: 5,
					weightKg: 100,
					rpe: 8,
				},
			],
		},
	],
};

describe("workoutsRoutes", () => {
	beforeEach(() => {
		createUserClientMock.mockReset();
	});

	it("creates a completed strength workout through the shared workout-center service path", async () => {
		const { client, insertedRows } = createWorkoutsAdminClient();
		createUserClientMock.mockReturnValue(client);
		const app = createAuthedApp();

		const response = await app.request("/api/workouts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				activityType: "STRENGTH",
				startedAt: "2026-03-17T09:00:00.000Z",
				durationSec: 2700,
				notes: "Felt strong",
				strengthSession,
			}),
		});

		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toMatchObject({
			data: {
				id: "workout-1",
				activity_type: "STRENGTH",
			},
		});
		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toMatchObject({
			athlete_id: "athlete-1",
			club_id: "club-1",
			activity_type: "STRENGTH",
			source: "MANUAL",
			notes: "Felt strong",
			raw_data: expect.objectContaining({
				schemaVersion: 1,
				activityType: "STRENGTH",
				mode: "log_past",
				status: "completed",
				sessionNotes: "Felt strong",
			}),
		});
	});

	it("updates a completed workout without bypassing the shared validation/update path", async () => {
		const { client, updatedRows } = createWorkoutsAdminClient();
		createUserClientMock.mockReturnValue(client);
		const app = createAuthedApp();

		const response = await app.request("/api/workouts/workout-1", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				notes: "Updated note",
				strengthSession: {
					...strengthSession,
					sessionNotes: "Updated note",
				},
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			data: {
				id: "workout-1",
			},
		});
		expect(updatedRows).toHaveLength(1);
		expect(updatedRows[0]).toMatchObject({
			notes: "Updated note",
			raw_data: expect.objectContaining({
				schemaVersion: 1,
				sessionNotes: "Updated note",
			}),
		});
	});
});
