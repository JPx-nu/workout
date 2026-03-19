import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const rootDir = path.resolve(import.meta.dirname, "..");

export function loadEnvFiles(relativePaths) {
	for (const relativePath of relativePaths) {
		const absolutePath = path.join(rootDir, relativePath);
		if (existsSync(absolutePath)) {
			process.loadEnvFile(absolutePath);
		}
	}
}

export function runWorkspaceCommand(args, envOverrides = {}) {
	const child = spawn("pnpm", args, {
		cwd: rootDir,
		stdio: "inherit",
		env: {
			...process.env,
			...envOverrides,
		},
		shell: process.platform === "win32",
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}

		process.exit(code ?? 0);
	});
}

export function runWorkspaceCommandSequence(commandGroups, envOverrides = {}) {
	const env = {
		...process.env,
		...envOverrides,
	};

	for (const args of commandGroups.slice(0, -1)) {
		const result = spawnSync("pnpm", args, {
			cwd: rootDir,
			stdio: "inherit",
			env,
			shell: process.platform === "win32",
		});

		if (result.signal) {
			process.kill(process.pid, result.signal);
			return;
		}

		if ((result.status ?? 0) !== 0) {
			process.exit(result.status ?? 1);
			return;
		}
	}

	const lastArgs = commandGroups.at(-1);
	if (!lastArgs) {
		return;
	}

	runWorkspaceCommand(lastArgs, envOverrides);
}
