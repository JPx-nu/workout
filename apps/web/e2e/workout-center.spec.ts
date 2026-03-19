import { expect, test } from "@playwright/test";
import { gotoAppPage } from "./helpers/app";
import { createUniqueLabel } from "./helpers/live-env";
import {
	addLibraryExercise,
	expectWorkoutCenterMessage,
	fillFirstStrengthSet,
	toDateInputValue,
} from "./helpers/workout-center";

test.describe("Workout Center", () => {
	test("opens the Workout Center from workout history", async ({ page }) => {
		await gotoAppPage(page, "dashboard/workouts");

		await expect(page.getByTestId("log-workout-link")).toHaveAttribute(
			"href",
			"/workout/dashboard/workouts/new",
		);
		await page.getByTestId("log-workout-link").click();

		await expect(page).toHaveURL(/\/workout\/dashboard\/workouts\/new/, { timeout: 60_000 });
		await expect(page.getByTestId("workout-center-page")).toBeVisible();
		await expect(page.getByRole("heading", { name: "Workout Center" })).toBeVisible();
	});

	test("logs a past strength workout through the browser", async ({ page }) => {
		const workoutNote = createUniqueLabel("[PW] logged strength workout");

		await gotoAppPage(page, "dashboard/workouts/new");

		await addLibraryExercise(page, "back squat", /barbell back squat/i);
		await fillFirstStrengthSet(page, { weightKg: 100, reps: 5, rpe: 8 });
		await page.getByTestId("workout-notes-input").fill(workoutNote);
		await page.getByTestId("primary-action-button").click();

		await expectWorkoutCenterMessage(page, "Workout saved to history.");

		await gotoAppPage(page, "dashboard/workouts");
		await expect(page.getByText(workoutNote)).toBeVisible();
	});

	test("schedules a future strength session from the Workout Center", async ({ page }) => {
		const title = createUniqueLabel("[PW] upper body session");
		const plannedDate = new Date();
		plannedDate.setDate(plannedDate.getDate() + 1);

		await gotoAppPage(page, "dashboard/workouts/new?mode=schedule");

		await page.getByTestId("workout-title-input").fill(title);
		await page.getByTestId("workout-date-input").fill(toDateInputValue(plannedDate));
		await page.getByTestId("workout-time-input").fill("08:00");
		await page.getByTestId("workout-duration-input").fill("45");
		await addLibraryExercise(page, "bench press", /barbell bench press/i);
		await fillFirstStrengthSet(page, { weightKg: 80, reps: 6, rpe: 7.5 });

		await page.getByTestId("primary-action-button").click();
		await expectWorkoutCenterMessage(page, "Session added to the training calendar.");

		await gotoAppPage(page, "dashboard/training");
		await expect(page.getByText(title).first()).toBeVisible();
	});
});
