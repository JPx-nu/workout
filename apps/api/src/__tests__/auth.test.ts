import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-test-key";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

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

function createProfileLookupClient() {
	return {
		from(table: string) {
			expect(table).toBe("profiles");
			return {
				select(columns: string) {
					expect(columns).toBe("club_id, role");
					return {
						eq(column: string, value: string) {
							expect(column).toBe("id");
							expect(value).toBe("11111111-1111-1111-1111-111111111111");
							return {
								maybeSingle: maybeSingleMock,
							};
						},
					};
				},
			};
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
		createClientMock.mockReturnValue(createProfileLookupClient());
	});

	it("uses JWT app_metadata when both club_id and role are present", async () => {
		const response = await createAuthedApp({
			sub: "11111111-1111-1111-1111-111111111111",
			app_metadata: {
				club_id: "22222222-2222-2222-2222-222222222222",
				role: "athlete",
			},
		}).request("/");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			userId: "11111111-1111-1111-1111-111111111111",
			clubId: "22222222-2222-2222-2222-222222222222",
			role: "athlete",
		});
		expect(createClientMock).not.toHaveBeenCalled();
	});

	it("falls back to the authenticated profile when app_metadata is stale", async () => {
		maybeSingleMock.mockResolvedValue({
			data: {
				club_id: "33333333-3333-3333-3333-333333333333",
				role: "coach",
			},
			error: null,
		});

		const response = await createAuthedApp({
			sub: "11111111-1111-1111-1111-111111111111",
			app_metadata: {},
		}).request("/");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			userId: "11111111-1111-1111-1111-111111111111",
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

	it("returns 401 when neither token claims nor profile data provide auth context", async () => {
		maybeSingleMock.mockResolvedValue({
			data: null,
			error: null,
		});

		const response = await createAuthedApp({
			sub: "11111111-1111-1111-1111-111111111111",
			app_metadata: {},
		}).request("/");

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			code: "AUTH_CONTEXT_MISSING",
			detail: "The authenticated user is missing required club or role context.",
		});
	});
});
