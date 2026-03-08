import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.WEB_URL ??= "https://jpx.nu";
process.env.API_URL ??= "https://api.jpx.nu";

const createAdminClientMock = vi.hoisted(() => vi.fn());
const getConnectedAccountsMock = vi.hoisted(() => vi.fn());

vi.mock("../services/ai/supabase.js", () => ({
	createAdminClient: createAdminClientMock,
}));

vi.mock("../services/integrations/token-manager.js", () => ({
	getConnectedAccounts: getConnectedAccountsMock,
}));

vi.mock("../middleware/auth.js", () => ({
	getAuth: () => ({
		userId: "athlete-1",
		clubId: "club-1",
		role: "athlete",
	}),
}));

import { integrationRoutes } from "../routes/integrations/index.js";

function createIntegrationAdminClient(queueSize = 0) {
	return {
		from(table: string) {
			if (table !== "webhook_queue") {
				throw new Error(`Unexpected table: ${table}`);
			}

			return {
				select() {
					return this;
				},
				in() {
					return Promise.resolve({
						count: queueSize,
						error: null,
					});
				},
			};
		},
	};
}

function createAuthedApp() {
	const app = new Hono();
	app.route("/api/integrations", integrationRoutes);
	return app;
}

describe("integrationRoutes", () => {
	beforeEach(() => {
		createAdminClientMock.mockReset();
		getConnectedAccountsMock.mockReset();
	});

	it("returns live provider status with Garmin marked as roadmap-only", async () => {
		createAdminClientMock.mockReturnValue(createIntegrationAdminClient(3));
		getConnectedAccountsMock.mockResolvedValue([
			{
				provider: "STRAVA",
				connected: true,
				lastSyncAt: "2026-03-08T08:30:00.000Z",
				providerUid: "strava-123",
			},
		]);
		const app = createAuthedApp();

		const response = await app.request("/api/integrations/status");

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			integrations: Array<{
				provider: string;
				connected: boolean;
				available: boolean;
				availabilityReason: string | null;
			}>;
			webhookQueueSize: number;
		};

		expect(body.webhookQueueSize).toBe(3);
		expect(body.integrations).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					provider: "STRAVA",
					connected: true,
					available: true,
				}),
				expect.objectContaining({
					provider: "GARMIN",
					connected: false,
					available: false,
					availabilityReason: "pending_approval",
				}),
			]),
		);
	});

	it("returns a problem response for Garmin connect until approval is complete", async () => {
		const app = createAuthedApp();

		const response = await app.request("/api/integrations/garmin/connect");

		expect(response.status).toBe(503);
		expect(response.headers.get("content-type")).toContain("application/problem+json");
		await expect(response.json()).resolves.toMatchObject({
			code: "GARMIN_PENDING_APPROVAL",
			detail: "Garmin integration requires business API approval.",
			applyAt: "https://developer.garmin.com/gc-developer-program/",
			status: "pending_approval",
		});
	});
});
