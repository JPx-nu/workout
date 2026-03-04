import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envExamplePath = resolve(root, ".env.example");
const envSchemaPath = resolve(root, "packages/types/src/validation.ts");

const envExample = readFileSync(envExamplePath, "utf8");
const envSchema = readFileSync(envSchemaPath, "utf8");

const errors = [];

function assert(condition, message) {
	if (!condition) {
		errors.push(message);
	}
}

assert(
	envExample.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="),
	".env.example must define NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
assert(
	!envExample.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY="),
	".env.example must not define deprecated NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
assert(
	envSchema.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1)"),
	"EnvSchema must require NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
assert(
	!envSchema.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
	"EnvSchema must not reference deprecated NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

if (errors.length > 0) {
	console.error("❌ Env key consistency check failed:");
	for (const err of errors) {
		console.error(`  - ${err}`);
	}
	process.exit(1);
}

console.log("✅ Env key consistency check passed");
