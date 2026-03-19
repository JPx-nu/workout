import { loadEnvFiles, runWorkspaceCommand } from "./playwright-dev-utils.mjs";

loadEnvFiles(["apps/api/.env"]);

runWorkspaceCommand(["--filter", "@triathlon/api", "dev"], {
	APP_ENV: process.env.APP_ENV ?? "local",
	API_URL: process.env.API_URL ?? "http://localhost:8787",
	WEB_URL: process.env.WEB_URL ?? "http://localhost:3100",
	PORT: process.env.PORT ?? "8787",
});
