import type { Meta, StoryObj } from "@storybook/nextjs";
import { DashboardShell } from "@/components/dashboard-shell";
import { SupabaseProvider } from "@/components/supabase-provider";
import type { DashboardAccessState } from "@/lib/dashboard/types";

const accessState: DashboardAccessState = {
	userId: "storybook-athlete",
	email: "storybook@jpx.nu",
	displayName: "Storybook Athlete",
	clubName: "JPX Performance",
	defaultView: "triathlon",
	isOnboarded: true,
	profile: {
		id: "storybook-athlete",
		email: "storybook@jpx.nu",
		displayName: "Storybook Athlete",
		role: "athlete",
		clubId: "club-storybook",
		clubName: "JPX Performance",
		avatarUrl: null,
		defaultView: "triathlon",
		preferences: {},
		timezone: "Europe/Prague",
	},
};

const shellContent = (
	<div className="grid gap-4 lg:grid-cols-2">
		<section className="glass-card p-6">
			<h2 className="text-lg font-semibold">Today</h2>
			<p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
				Coach summary, upcoming sessions, and recovery prompts should remain readable at both mobile
				and desktop widths.
			</p>
		</section>
		<section className="glass-card p-6">
			<h2 className="text-lg font-semibold">Next session</h2>
			<p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
				Tempo ride at 18:00 with brick transition work.
			</p>
		</section>
	</div>
);

const meta = {
	title: "Shells/DashboardShell",
	component: DashboardShell,
	render: () => (
		<SupabaseProvider>
			<DashboardShell accessState={accessState}>{shellContent}</DashboardShell>
		</SupabaseProvider>
	),
	parameters: {
		layout: "fullscreen",
		chromatic: {
			viewports: [390, 1280],
		},
	},
} satisfies Meta<typeof DashboardShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DashboardHome: Story = {
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/dashboard",
			},
		},
	},
};

export const CoachRoute: Story = {
	parameters: {
		nextjs: {
			navigation: {
				pathname: "/dashboard/coach",
			},
		},
	},
};
