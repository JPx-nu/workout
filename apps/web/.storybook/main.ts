import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs";

const nextConfigPath = new URL("../next.config.ts", import.meta.url);

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-a11y"],
	staticDirs: ["../public"],
	framework: {
		name: "@storybook/nextjs",
		options: {
			nextConfigPath: path.resolve(fileURLToPath(nextConfigPath)),
		},
	},
	core: {
		disableTelemetry: true,
	},
};

export default config;
