// ============================================================
// esbuild deployment bundler
//
// Bundles API source + workspace packages (@triathlon/*) into
// a single output directory. npm packages stay external and are
// installed via `npm install` at deploy time.
//
// Usage: node esbuild.deploy.mjs
// ============================================================

import { readFileSync } from "node:fs";
import * as esbuild from "esbuild";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

// Externalize all npm dependencies — installed via npm install at deploy time.
// Workspace packages (@triathlon/*) are source-only (.ts) and must be bundled.
const external = Object.keys(pkg.dependencies || {}).filter(
	(dep) => !dep.startsWith("@triathlon/"),
);

await esbuild.build({
	entryPoints: ["src/server.ts"],
	bundle: true,
	platform: "node",
	target: "node24",
	format: "esm",
	outdir: "dist-deploy",
	external,
	sourcemap: true,
	banner: {
		js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
	},
});

console.log("Build complete → dist-deploy/");
