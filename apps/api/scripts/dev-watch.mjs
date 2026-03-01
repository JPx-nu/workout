import { spawn } from "node:child_process";

const env = { ...process.env };

// WSL can inherit Windows temp paths, but tsx watch IPC needs a Linux socket path.
const tempPath = env.TMPDIR ?? env.TMP ?? env.TEMP ?? "";
const hasWindowsTempPath =
	typeof tempPath === "string" &&
	(tempPath.startsWith("/mnt/") ||
		tempPath.includes("AppData/Local/Temp") ||
		tempPath.includes("AppData\\Local\\Temp"));

if (
	process.platform === "linux" &&
	(env.WSL_DISTRO_NAME || env.WSL_INTEROP || hasWindowsTempPath)
) {
	env.TMPDIR = "/tmp";
	env.TMP = "/tmp";
	env.TEMP = "/tmp";
}

const child = spawn("tsx", ["watch", "--env-file=.env", "src/server.ts"], {
	stdio: "inherit",
	env,
	shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});
