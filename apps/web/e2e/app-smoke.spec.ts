import { expectNoSeriousA11yViolations } from "./helpers/a11y";
import { buildAppUrl, gotoAppPage } from "./helpers/app";
import { expect, test } from "./helpers/test";

const routeChecks = [
	{
		path: "dashboard",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByText(/good (morning|afternoon|evening)/i).first()).toBeVisible();
		},
	},
	{
		path: "dashboard/coach",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByRole("heading", { name: "AI Coach" }).first()).toBeVisible();
		},
	},
	{
		path: "dashboard/training",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByRole("heading", { name: "Training Calendar" }).first()).toBeVisible();
		},
	},
	{
		path: "dashboard/workouts",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByRole("heading", { name: "Workouts" }).first()).toBeVisible();
		},
	},
	{
		path: "dashboard/workouts/new?mode=schedule",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByRole("heading", { name: "Workout Center" }).first()).toBeVisible();
		},
	},
	{
		path: "dashboard/settings",
		assertion: async (page: Parameters<typeof gotoAppPage>[0]) => {
			await expect(page.getByTestId("settings-profile-panel")).toBeVisible();
			await expect(page.getByTestId("settings-integrations-panel")).toBeVisible();
		},
	},
] as const;

test.describe("Public web smoke @smoke", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("renders the login entrypoint without serious accessibility violations @smoke", async ({
		page,
	}, testInfo) => {
		await page.goto(buildAppUrl("login"));
		await expect(page.getByTestId("login-page")).toBeVisible();
		await expect(page.getByTestId("login-email")).toBeVisible();
		await expect(page.getByTestId("login-password")).toBeVisible();
		await expectNoSeriousA11yViolations(page, testInfo);
	});
});

test.describe("Authenticated web smoke @smoke", () => {
	test("keeps authenticated desktop and mobile-web routes healthy @smoke", async ({
		page,
	}, testInfo) => {
		for (const route of routeChecks) {
			await gotoAppPage(page, route.path);
			await route.assertion(page);
			if (route.path === "dashboard") {
				await expectNoSeriousA11yViolations(page, testInfo);
			}
		}
	});
});
