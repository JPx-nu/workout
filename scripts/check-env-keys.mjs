import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envExamplePath = resolve(root, ".env.example");
const envSchemaPath = resolve(root, "packages/types/src/validation.ts");
const startupEnvPath = resolve(root, "apps/api/src/config/startup-env.ts");
const deployWorkflowPath = resolve(root, ".github/workflows/deploy.yml");

const envExample = readFileSync(envExamplePath, "utf8");
const envSchema = readFileSync(envSchemaPath, "utf8");
const startupEnv = readFileSync(startupEnvPath, "utf8");
const deployWorkflow = readFileSync(deployWorkflowPath, "utf8");

const errors = [];

function assert(condition, message) {
	if (!condition) {
		errors.push(message);
	}
}

function extractArray(source, name) {
	const match = source.match(new RegExp(`const ${name} = \\[(.*?)\\] as const;`, "s"));
	if (!match) {
		errors.push(`Unable to find ${name} in startup env config`);
		return [];
	}

	return [...match[1].matchAll(/"([^"]+)"/g)].map(([, value]) => value);
}

extractArray(startupEnv, "REQUIRED_ENV_KEYS");
extractArray(startupEnv, "AI_ENV_KEYS");
extractArray(startupEnv, "INTEGRATION_REQUIRED_KEYS");

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
assert(
	!envSchema.includes("SUPABASE_JWT_SECRET"),
	"EnvSchema must not reference legacy SUPABASE_JWT_SECRET",
);
assert(
	envSchema.includes("INTEGRATION_ENCRYPTION_KEY: z.string().optional()"),
	"EnvSchema must include INTEGRATION_ENCRYPTION_KEY",
);
assert(
	envSchema.includes("APP_SIGNING_SECRET: z.string().optional()"),
	"EnvSchema must include APP_SIGNING_SECRET",
);
assert(
	!envExample.includes("SUPABASE_JWT_SECRET="),
	".env.example must not define legacy SUPABASE_JWT_SECRET",
);
assert(
	envExample.includes("APP_SIGNING_SECRET="),
	".env.example must define APP_SIGNING_SECRET for local/dev fallback use",
);
assert(
	!deployWorkflow.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
	"deploy workflow must not reference deprecated NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
assert(
	deployWorkflow.includes("secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
	"deploy workflow must source the publishable Supabase key from NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);
assert(
	deployWorkflow.includes("secrets.NEXT_PUBLIC_API_URL"),
	"deploy workflow must source API_URL from NEXT_PUBLIC_API_URL",
);
assert(
	deployWorkflow.includes('API_VERSION: ${{ secrets.AZURE_OPENAI_API_VERSION }}'),
	"deploy workflow must allow AZURE_OPENAI_API_VERSION as an optional override secret",
);
assert(
	deployWorkflow.includes('INTEGRATION_KEY: ${{ secrets.INTEGRATION_ENCRYPTION_KEY }}'),
	"deploy workflow must allow INTEGRATION_ENCRYPTION_KEY as an optional override secret",
);
assert(
	!deployWorkflow.includes('[API_VERSION]="AZURE_OPENAI_API_VERSION"'),
	"deploy workflow must not require AZURE_OPENAI_API_VERSION in preflight",
);
assert(
	!deployWorkflow.includes('[INTEGRATION_KEY]="INTEGRATION_ENCRYPTION_KEY"'),
	"deploy workflow must not require INTEGRATION_ENCRYPTION_KEY in preflight",
);
assert(
	deployWorkflow.includes('if [ -n "${API_VERSION:-}" ]; then'),
	"deploy workflow must preserve Azure or code defaults when AZURE_OPENAI_API_VERSION is unset",
);
assert(
	deployWorkflow.includes('settings+=("AZURE_OPENAI_API_VERSION=$API_VERSION")'),
	"deploy workflow must only apply AZURE_OPENAI_API_VERSION when an override is provided",
);
assert(
	deployWorkflow.includes('if [ -n "${INTEGRATION_KEY:-}" ]; then'),
	"deploy workflow must preserve Azure-managed integration secrets when no override is provided",
);
assert(
	deployWorkflow.includes('settings+=("INTEGRATION_ENCRYPTION_KEY=$INTEGRATION_KEY")'),
	"deploy workflow must only apply INTEGRATION_ENCRYPTION_KEY when an override is provided",
);
assert(
	!deployWorkflow.includes("SUPABASE_JWT_SECRET"),
	"deploy workflow must not reference legacy SUPABASE_JWT_SECRET",
);
const requiredApiSettingMappings = [
	["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_ENDPOINT=$EP"],
	["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_KEY=$KEY"],
	["AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_DEPLOYMENT=$DEP"],
	["SUPABASE_URL", "SUPABASE_URL=$SUPA_URL"],
	["SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY=$SUPA_PUBLISHABLE"],
	["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY=$SUPA_SVC"],
	["WEB_URL", "WEB_URL=$WEB"],
	["API_URL", "API_URL=$API_URL"],
];
for (const [key, pattern] of requiredApiSettingMappings) {
	assert(
		deployWorkflow.includes(pattern),
		`deploy workflow must configure API app setting ${key}`,
	);
}
assert(
	deployWorkflow.includes("concurrency:"),
	"deploy workflow must define workflow concurrency to prevent overlapping deploys",
);

if (errors.length > 0) {
	console.error("Env key consistency check failed:");
	for (const err of errors) {
		console.error(`  - ${err}`);
	}
	process.exit(1);
}

console.log("Env key consistency check passed");
