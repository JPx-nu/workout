import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const defaultBaseUrl = "http://localhost:3100/workout";
const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim() || defaultBaseUrl;
const usesLocalStack =
	appBaseUrl.startsWith("http://localhost:3100/workout") ||
	appBaseUrl.startsWith("http://127.0.0.1:3100/workout");
const useDevServers = process.env.PLAYWRIGHT_USE_DEV_SERVER !== "false";
const useRemoteApi = process.env.PLAYWRIGHT_USE_REMOTE_API === "true";

export default defineConfig({
	testDir: "./e2e",
	outputDir: "../../.qa-artifacts/playwright/test-results-web",
	timeout: 120_000,
	expect: {
		timeout: 20_000,
	},
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI
		? [
				["list"],
				["github"],
				["html", { open: "never", outputFolder: "../../.qa-artifacts/playwright/report-web" }],
			]
		: [
				["list"],
				["html", { open: "never", outputFolder: "../../.qa-artifacts/playwright/report-web" }],
			],
	workers: 1,
	use: {
		baseURL: appBaseUrl,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	webServer: usesLocalStack
		? [
				...(!useRemoteApi
					? [
							{
								command: useDevServers
									? "node ../../scripts/run-playwright-api-dev.mjs"
									: "node ../../scripts/run-playwright-api-start.mjs",
								url: "http://localhost:8787/health",
								reuseExistingServer: true,
								timeout: 300_000,
							},
						]
					: []),
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
			name: "desktop-chrome",
			use: {
				...devices["Desktop Chrome"],
				storageState: path.join(__dirname, ".auth/user.json"),
			},
			dependencies: ["setup"],
		},
		{
			name: "mobile-chrome",
			use: {
				...devices["Pixel 5"],
				storageState: path.join(__dirname, ".auth/user.json"),
			},
			dependencies: ["setup"],
		},
		{
			name: "mobile-safari",
			use: {
				...devices["iPhone 13"],
				storageState: path.join(__dirname, ".auth/user.json"),
			},
			dependencies: ["setup"],
		},
	],
});
