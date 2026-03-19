import path from "node:path";
import { test as setup } from "@playwright/test";
import { signInLiveAthlete } from "./helpers/app";

const authFile = path.join(__dirname, "..", ".auth/user.json");

setup("authenticate live athlete", async ({ page }) => {
	await signInLiveAthlete(page);
	await page.context().storageState({ path: authFile });
});
