import type { Page } from "@playwright/test";
import { buildAppUrl, gotoAppPage } from "./helpers/app";
import { createUniqueLabel } from "./helpers/live-env";
import { expect, test } from "./helpers/test";

async function waitForCoachResponse(page: Page) {
	const sendButton = page.getByTestId("coach-send-button").first();
	await expect(sendButton).toBeVisible({ timeout: 30_000 });
	await expect(sendButton)
		.toHaveAttribute("aria-label", /stop generating/i, { timeout: 30_000 })
		.catch(() => undefined);
	await expect(sendButton).toHaveAttribute("aria-label", /send message/i, { timeout: 120_000 });
}

test.describe("AI Coach", () => {
	test("logs a completed workout and applies a follow-up note through chat", async ({ page }) => {
		const workoutNote = createUniqueLabel("[PW] ai quick log");

		await gotoAppPage(page, "dashboard/coach");

		await page.getByTestId("coach-input").first().fill("log a 12 minute 2km run from yesterday");
		await page.getByTestId("coach-send-button").first().click();
		await waitForCoachResponse(page);

		await page.getByTestId("coach-input").first().fill(workoutNote);
		await page.getByTestId("coach-send-button").first().click();
		await waitForCoachResponse(page);

		await gotoAppPage(page, "dashboard/workouts");
		await expect(page.getByText(workoutNote).first()).toBeVisible({ timeout: 120_000 });
	});

	test("creates a future workout session through AI chat", async ({ page }) => {
		const title = createUniqueLabel("[PW] ai scheduled session");

		await gotoAppPage(page, "dashboard/coach");

		await page
			.getByTestId("coach-input")
			.first()
			.fill(
				`Schedule a strength workout for tomorrow at 08:00 titled "${title}" with 3 sets of 5 barbell back squats at RPE 7.`,
			);
		await page.getByTestId("coach-send-button").first().click();
		await waitForCoachResponse(page);

		await page.goto(buildAppUrl("dashboard/training"));
		await expect(page.getByText(title).first()).toBeVisible({ timeout: 120_000 });
	});
});
