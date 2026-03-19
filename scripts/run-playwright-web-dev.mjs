import { loadEnvFiles, runWorkspaceCommand } from "./playwright-dev-utils.mjs";

loadEnvFiles(["apps/web/.env.local"]);

runWorkspaceCommand(["--filter", "web", "dev"], {
	NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
	NEXT_PUBLIC_ENABLE_DEMO: process.env.NEXT_PUBLIC_ENABLE_DEMO ?? "true",
	NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3100",
});
