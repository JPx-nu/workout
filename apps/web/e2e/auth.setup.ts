import path from "node:path";
import { signInLiveAthlete } from "./helpers/app";
import { test } from "./helpers/test";

const authFile = path.join(__dirname, "..", ".auth/user.json");

test("authenticate live athlete", async ({ page }) => {
	await signInLiveAthlete(page);
	await page.context().storageState({ path: authFile });
});
