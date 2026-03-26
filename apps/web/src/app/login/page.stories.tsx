import type { Meta, StoryObj } from "@storybook/nextjs";
import LoginPage from "./page";

const meta = {
	title: "Pages/Login",
	component: LoginPage,
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/login",
			},
		},
		chromatic: {
			viewports: [390, 1280],
		},
	},
} satisfies Meta<typeof LoginPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SignIn: Story = {};
