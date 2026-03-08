import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.hoisted(() => vi.fn());

vi.mock("../services/ai/supabase.js", () => ({
	createAdminClient: createAdminClientMock,
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
}));

import { healthRoutes } from "../routes/health/index.js";

type ExistingRow = {
	athlete_id: string;
	source: string;
	external_id: string;
};

function createHealthAdminClient(options?: {
	existingWorkouts?: ExistingRow[];
	existingMetrics?: ExistingRow[];
}) {
	const existingWorkouts = options?.existingWorkouts ?? [];
	const existingMetrics = options?.existingMetrics ?? [];
	const upserts = {
		workouts: [] as unknown[],
		health_metrics: [] as unknown[],
		daily_logs: [] as unknown[],
	};

	const client = {
		from(table: "workouts" | "health_metrics" | "daily_logs") {
			const filters: Record<string, unknown> = {};

			return {
				select() {
					return this;
				},
				eq(column: string, value: unknown) {
					filters[column] = value;
					return this;
				},
				in(_column: string, values: string[]) {
					const records = table === "workouts" ? existingWorkouts : existingMetrics;
					return Promise.resolve({
						data: records.filter(
							(row) =>
								row.athlete_id === filters.athlete_id &&
								row.source === filters.source &&
								values.includes(row.external_id),
						),
						error: null,
					});
				},
				upsert(rows: unknown) {
					upserts[table].push(rows);
					return Promise.resolve({ error: null });
				},
			};
		},
	};

	return { client, upserts };
}

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/health", healthRoutes);
	return app;
}

describe("healthRoutes", () => {
	beforeEach(() => {
		createAdminClientMock.mockReset();
	});

	it("rejects invalid ingest payloads", async () => {
		createAdminClientMock.mockReturnValue(createHealthAdminClient().client);
		const app = createAuthedApp();

		const response = await app.request("/api/health/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ workouts: [] }),
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			code: "VALIDATION_FAILED",
			title: "Bad Request",
			detail: "Request body failed validation.",
		});
	});

	it("deduplicates payload rows and reports existing external ids as skipped", async () => {
		const { client, upserts } = createHealthAdminClient({
			existingWorkouts: [
				{
					athlete_id: "athlete-1",
					source: "HEALTH_CONNECT",
					external_id: "wk-1",
				},
			],
			existingMetrics: [
				{
					athlete_id: "athlete-1",
					source: "HEALTH_CONNECT",
					external_id: "met-1",
				},
			],
		});
		createAdminClientMock.mockReturnValue(client);
		const app = createAuthedApp();

		const response = await app.request("/api/health/ingest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sourcePlatform: "HEALTH_CONNECT",
				syncedAt: "2026-03-08T09:00:00.000Z",
				workouts: [
					{
						externalId: "wk-1",
						activityType: "RUN",
						source: "HEALTH_CONNECT",
						startedAt: "2026-03-07T08:00:00.000Z",
						durationS: 3600,
					},
					{
						externalId: "wk-1",
						activityType: "RUN",
						source: "HEALTH_CONNECT",
						startedAt: "2026-03-07T08:00:00.000Z",
						durationS: 3600,
					},
				],
				metrics: [
					{
						externalId: "met-1",
						metricType: "HRV",
						value: 64,
						recordedAt: "2026-03-08T06:00:00.000Z",
						source: "HEALTH_CONNECT",
					},
					{
						externalId: "met-1",
						metricType: "HRV",
						value: 64,
						recordedAt: "2026-03-08T06:00:00.000Z",
						source: "HEALTH_CONNECT",
					},
				],
				dailyLogs: [
					{
						logDate: "2026-03-08",
						sleepHours: 7.5,
						hrv: 64,
					},
				],
			}),
		});

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			status: "ingested",
			sourcePlatform: "HEALTH_CONNECT",
			workoutsInserted: 0,
			workoutsSkipped: 1,
			metricsInserted: 0,
			metricsSkipped: 1,
			dailyLogsUpserted: 1,
		});

		expect(upserts.workouts).toHaveLength(1);
		expect(upserts.workouts[0] as unknown[]).toHaveLength(1);
		expect(upserts.health_metrics).toHaveLength(1);
		expect(upserts.health_metrics[0] as unknown[]).toHaveLength(1);
		expect(upserts.daily_logs).toHaveLength(1);
	});
});
