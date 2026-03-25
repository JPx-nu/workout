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
	envExample.includes("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT="),
	".env.example must define AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT",
);
assert(
	deployWorkflow.includes('EMBED_DEP: ${{ secrets.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT }}'),
	"deploy workflow must allow AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT as an optional secret",
);
assert(
	deployWorkflow.includes('KEY_VAULT_NAME: ${{ secrets.AZURE_KEY_VAULT_NAME }}'),
	"deploy workflow must require AZURE_KEY_VAULT_NAME in preflight",
);
assert(
	!deployWorkflow.includes('INTEGRATION_KEY: ${{ secrets.INTEGRATION_ENCRYPTION_KEY }}'),
	"deploy workflow must not require INTEGRATION_ENCRYPTION_KEY from GitHub once Key Vault references are used",
);
assert(
	deployWorkflow.includes('AZURE_OPENAI_API_VERSION: "2024-12-01-preview"'),
	"deploy workflow must define the default AZURE_OPENAI_API_VERSION in workflow env",
);
assert(
	deployWorkflow.includes('AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION'),
	"deploy workflow must always configure AZURE_OPENAI_API_VERSION from workflow env",
);
assert(
	!deployWorkflow.includes("AZURE_CREDENTIALS"),
	"deploy workflow must not use long-lived AZURE_CREDENTIALS auth",
);
assert(
	deployWorkflow.includes('client-id: ${{ secrets.AZURE_CLIENT_ID }}'),
	"deploy workflow must use OIDC AZURE_CLIENT_ID auth",
);
assert(
	deployWorkflow.includes('tenant-id: ${{ secrets.AZURE_TENANT_ID }}'),
	"deploy workflow must use OIDC AZURE_TENANT_ID auth",
);
assert(
	deployWorkflow.includes('subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}'),
	"deploy workflow must use OIDC AZURE_SUBSCRIPTION_ID auth",
);
assert(
	deployWorkflow.includes('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=$EMBED_DEP'),
	"deploy workflow must configure the embeddings deployment app setting explicitly",
);
assert(
	deployWorkflow.includes('@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=azure-openai-api-key)'),
	"deploy workflow must configure the Azure OpenAI API key via Key Vault reference",
);
assert(
	deployWorkflow.includes('@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=supabase-service-role-key)'),
	"deploy workflow must configure the Supabase service role key via Key Vault reference",
);
assert(
	deployWorkflow.includes('@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=integration-encryption-key)'),
	"deploy workflow must configure the integration encryption key via Key Vault reference",
);
assert(
	deployWorkflow.includes("node ./scripts/smoke-test-ai.mjs"),
	"deploy workflow must smoke-test the published AI path after web deploy",
);
assert(
	!deployWorkflow.includes("SUPABASE_JWT_SECRET"),
	"deploy workflow must not reference legacy SUPABASE_JWT_SECRET",
);
const requiredApiSettingMappings = [
	["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_ENDPOINT=$EP"],
	[
		"AZURE_OPENAI_API_KEY",
		"AZURE_OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=azure-openai-api-key)",
	],
	["AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_DEPLOYMENT=$DEP"],
	["SUPABASE_URL", "SUPABASE_URL=$SUPA_URL"],
	["SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY=$SUPA_PUBLISHABLE"],
	[
		"SUPABASE_SERVICE_ROLE_KEY",
		"SUPABASE_SERVICE_ROLE_KEY=@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=supabase-service-role-key)",
	],
	["WEB_URL", "WEB_URL=$WEB"],
	["API_URL", "API_URL=$API_URL"],
	[
		"INTEGRATION_ENCRYPTION_KEY",
		"INTEGRATION_ENCRYPTION_KEY=@Microsoft.KeyVault(VaultName=$KEY_VAULT_NAME;SecretName=integration-encryption-key)",
	],
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
