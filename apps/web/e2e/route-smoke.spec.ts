import { gotoAppPage } from "./helpers/app";
import { expect, test } from "./helpers/test";

test.describe("Dashboard route stability", () => {
	test("keeps authenticated subroutes mounted after direct navigation", async ({ page }) => {
		await gotoAppPage(page, "dashboard");
		await gotoAppPage(page, "dashboard/coach");
		await gotoAppPage(page, "dashboard/workouts");
		await gotoAppPage(page, "dashboard/workouts/new");
		await gotoAppPage(page, "dashboard/workouts/new?mode=schedule");
		await expect(page.getByTestId("primary-action-button")).toContainText("Schedule sessions");
	});
});
