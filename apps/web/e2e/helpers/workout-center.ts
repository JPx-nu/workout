import { expect, type Page } from "@playwright/test";

function pad(value: number): string {
	return value.toString().padStart(2, "0");
}

export function toDateInputValue(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function openExercisePicker(page: Page): Promise<void> {
	await page.getByTestId("add-exercise-button").first().click();
	await expect(page.getByTestId("exercise-picker").first()).toBeVisible();
}

export async function addLibraryExercise(
	page: Page,
	searchTerm: string,
	exerciseName: RegExp,
): Promise<void> {
	await openExercisePicker(page);
	await page.getByTestId("exercise-tab-library").first().click();
	await page.getByTestId("exercise-search-input").first().fill(searchTerm);
	const firstResult = page.locator('[data-testid^="exercise-result-"]').first();
	await expect(firstResult).toBeVisible();
	await expect(firstResult).toContainText(exerciseName);
	await firstResult.click();
}

export async function fillFirstStrengthSet(
	page: Page,
	values: {
		weightKg?: number | string;
		reps?: number | string;
		rpe?: number | string;
	},
): Promise<void> {
	if (values.weightKg !== undefined) {
		await page.getByLabel("Weight for set 1").fill(String(values.weightKg));
	}

	if (values.reps !== undefined) {
		await page.getByLabel("Reps for set 1").fill(String(values.reps));
	}

	if (values.rpe !== undefined) {
		await page.getByLabel("RPE for set 1").fill(String(values.rpe));
	}
}

export async function expectWorkoutCenterMessage(
	page: Page,
	message: string | RegExp,
): Promise<void> {
	await expect(page.getByTestId("workout-center-message").first()).toContainText(message);
}
