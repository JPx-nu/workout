import type { Preview } from "@storybook/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import "../src/app/globals.css";

const preview: Preview = {
	parameters: {
		layout: "fullscreen",
		nextjs: {
			appDirectory: true,
			navigation: {
				pathname: "/dashboard",
			},
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		backgrounds: {
			default: "dark-glass",
			values: [
				{ name: "dark-glass", value: "#0d1222" },
				{ name: "light-glass", value: "#eef4ff" },
			],
		},
	},
	decorators: [
		(Story) => (
			<ThemeProvider>
				<div style={{ minHeight: "100vh" }}>
					<Story />
				</div>
			</ThemeProvider>
		),
	],
};

export default preview;
