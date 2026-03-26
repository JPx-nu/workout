import type { Meta, StoryObj } from "@storybook/nextjs";
import { MobileNav } from "@/components/mobile-nav";

const meta = {
	title: "Navigation/MobileNav",
	component: MobileNav,
	decorators: [
		(Story) => (
			<div style={{ margin: "0 auto", maxWidth: 390, minHeight: 844, position: "relative" }}>
				<div className="glass-card mx-4 mt-6 p-5">
					<h2 className="text-base font-semibold">Mobile viewport</h2>
					<p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
						Bottom navigation should remain touch-friendly and visually stable in the mobile-web
						layout.
					</p>
				</div>
				<Story />
			</div>
		),
	],
	parameters: {
		chromatic: {
			viewports: [390],
		},
	},
} satisfies Meta<typeof MobileNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CoachActive: Story = {
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/dashboard/coach",
			},
		},
	},
};

export const WorkoutsActive: Story = {
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/dashboard/workouts",
			},
		},
	},
};
