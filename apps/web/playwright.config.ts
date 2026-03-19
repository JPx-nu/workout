import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = "http://localhost:3100/workout";
const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || defaultBaseUrl;
const usesLocalStack =
	appBaseUrl.startsWith("http://localhost:3100/workout") ||
	appBaseUrl.startsWith("http://127.0.0.1:3100/workout");
const useDevServers = process.env.PLAYWRIGHT_USE_DEV_SERVER !== "false";

export default defineConfig({
	testDir: "./e2e",
	outputDir: "./test-results",
	timeout: 120_000,
	expect: {
		timeout: 20_000,
	},
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
	workers: 1,
	use: {
		baseURL: appBaseUrl,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: usesLocalStack
		? [
				{
					command: useDevServers
						? "node ../../scripts/run-playwright-api-dev.mjs"
						: "node ../../scripts/run-playwright-api-start.mjs",
					url: "http://localhost:8787/health",
					reuseExistingServer: true,
					timeout: 300_000,
				},
				{
					command: useDevServers
						? "node ../../scripts/run-playwright-web-dev.mjs"
						: "node ../../scripts/run-playwright-web-start.mjs",
					url: `${defaultBaseUrl}/health`,
					reuseExistingServer: true,
					timeout: 300_000,
				},
			]
		: undefined,
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: path.join(__dirname, ".auth/user.json"),
			},
			dependencies: ["setup"],
		},
	],
});
