import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-test-key";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());
const profileUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
	createClient: createClientMock,
}));

const { extractClaims, getAuth } = await import("../middleware/auth.js");

type TestAppEnv = {
	Variables: {
		auth: unknown;
		jwt: string;
		jwtPayload: Record<string, unknown>;
	};
};

const USER_ID = "11111111-1111-1111-1111-111111111111";

function createProfileLookupClient(options?: {
	profile?: { club_id?: unknown; role?: unknown } | null;
	derivedClubByTable?: Partial<Record<string, string | null>>;
	profileUpdateError?: { message: string } | null;
}) {
	const profile = options?.profile ?? null;
	const derivedClubByTable = options?.derivedClubByTable ?? {};

	return {
		from(table: string) {
			if (table === "profiles") {
				return {
					select(columns: string) {
						expect(columns).toBe("club_id, role");
						return {
							eq(column: string, value: string) {
								expect(column).toBe("id");
								expect(value).toBe(USER_ID);
								return {
									maybeSingle: () =>
										Promise.resolve({
											data: profile,
											error: null,
										}),
								};
							},
						};
					},
					update(payload: { club_id: string }) {
						profileUpdateMock(payload);
						return {
							eq(column: string, value: string) {
								expect(column).toBe("id");
								expect(value).toBe(USER_ID);
								return Promise.resolve({
									error: options?.profileUpdateError ?? null,
								});
							},
						};
					},
				};
			}

			if (
				table === "daily_logs" ||
				table === "workouts" ||
				table === "training_plans" ||
				table === "conversations" ||
				table === "injuries"
			) {
				return {
					select(columns: string) {
						expect(columns).toBe("club_id");
						return {
							eq(column: string, value: string) {
								expect(column).toBe("athlete_id");
								expect(value).toBe(USER_ID);
								return {
									order(orderedBy: string, options: { ascending: boolean }) {
										expect(options).toEqual({ ascending: false });
										expect(orderedBy.length).toBeGreaterThan(0);
										return {
											limit(limitValue: number) {
												expect(limitValue).toBe(1);
												return {
													maybeSingle: () =>
														Promise.resolve({
															data: derivedClubByTable[table]
																? { club_id: derivedClubByTable[table] }
																: null,
															error: null,
														}),
												};
											},
										};
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

function createAuthedApp(payload: Record<string, unknown>, token = "jwt-token") {
	const app = new Hono<TestAppEnv>();

	app.use("*", async (c, next) => {
		c.set("jwtPayload", payload);
		c.set("jwt", token);
		await next();
	});

	app.use("*", extractClaims);

	app.get("/", (c) => c.json(getAuth(c)));

	return app;
}

describe("extractClaims", () => {
	beforeEach(() => {
		maybeSingleMock.mockReset();
		createClientMock.mockReset();
		profileUpdateMock.mockReset();
		createClientMock.mockReturnValue(createProfileLookupClient());
	});

	it("uses JWT app_metadata when both club_id and role are present", async () => {
		const response = await createAuthedApp({
			sub: USER_ID,
			app_metadata: {
				club_id: "22222222-2222-2222-2222-222222222222",
				role: "athlete",
			},
		}).request("/");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			userId: USER_ID,
			clubId: "22222222-2222-2222-2222-222222222222",
			role: "athlete",
		});
		expect(createClientMock).not.toHaveBeenCalled();
	});

	it("falls back to the authenticated profile when app_metadata is stale", async () => {
		createClientMock.mockReturnValue(
			createProfileLookupClient({
				profile: {
					club_id: "33333333-3333-3333-3333-333333333333",
					role: "coach",
				},
			}),
		);

		const response = await createAuthedApp({
			sub: USER_ID,
			app_metadata: {},
		}).request("/");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			userId: USER_ID,
			clubId: "33333333-3333-3333-3333-333333333333",
			role: "coach",
		});
		expect(createClientMock).toHaveBeenCalledWith(
			process.env.SUPABASE_URL,
			process.env.SUPABASE_ANON_KEY,
			expect.objectContaining({
				global: {
					headers: { Authorization: "Bearer jwt-token" },
				},
			}),
		);
	});

	it("derives club_id from owned athlete data and backfills the profile when missing", async () => {
		createClientMock.mockReturnValue(
			createProfileLookupClient({
				profile: {
					club_id: null,
					role: "athlete",
				},
				derivedClubByTable: {
					daily_logs: "44444444-4444-4444-4444-444444444444",
				},
			}),
		);

		const response = await createAuthedApp({
			sub: USER_ID,
			app_metadata: {},
		}).request("/");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			userId: USER_ID,
			clubId: "44444444-4444-4444-4444-444444444444",
			role: "athlete",
		});
		expect(profileUpdateMock).toHaveBeenCalledWith({
			club_id: "44444444-4444-4444-4444-444444444444",
		});
	});

	it("returns 401 when neither token claims nor fallback data provide auth context", async () => {
		createClientMock.mockReturnValue(
			createProfileLookupClient({
				profile: {
					club_id: null,
					role: "athlete",
				},
			}),
		);

		const response = await createAuthedApp({
			sub: USER_ID,
			app_metadata: {},
		}).request("/");

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			code: "AUTH_CONTEXT_MISSING",
			detail: "The authenticated user is missing required club or role context.",
		});
	});
});
