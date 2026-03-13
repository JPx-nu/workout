import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webSrcDir = path.join(repoRoot, "apps", "web", "src");
const dynamicEnvPattern = /process\.env\s*\[/;

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
			continue;
		}

		if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
			files.push(fullPath);
		}
	}

	return files;
}

const sourceFiles = await walk(webSrcDir);
const violations = [];

for (const filePath of sourceFiles) {
	const contents = await readFile(filePath, "utf8");
	const lines = contents.split(/\r?\n/);

	for (const [index, line] of lines.entries()) {
		const trimmed = line.trimStart();
		if (
			trimmed.startsWith("//") ||
			trimmed.startsWith("/*") ||
			trimmed.startsWith("*") ||
			trimmed.startsWith("*/") ||
			!dynamicEnvPattern.test(line)
		) {
			continue;
		}

		violations.push({
			filePath: path.relative(repoRoot, filePath),
			lineNumber: index + 1,
			line: line.trim(),
		});
	}
}

if (violations.length > 0) {
	console.error(
		[
			"Dynamic process.env[...] access is not allowed in apps/web/src.",
			"Next standalone only guarantees public env values in browser bundles when they are read via static property access such as process.env.NEXT_PUBLIC_SUPABASE_URL.",
			"",
			...violations.map(
				({ filePath, lineNumber, line }) => `- ${filePath}:${lineNumber} ${line}`,
			),
		].join("\n"),
	);
	process.exit(1);
}
