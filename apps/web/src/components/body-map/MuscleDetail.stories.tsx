import type { Meta, StoryObj } from "@storybook/nextjs";
import type { MuscleFatigue } from "@triathlon/core";
import MuscleDetail from "@/components/body-map/MuscleDetail";

const fatigueData: MuscleFatigue[] = [
	{ muscle: "Quadriceps", bodyPart: "quadriceps", level: 82, status: "high" },
	{ muscle: "Hamstrings", bodyPart: "hamstrings", level: 56, status: "moderate" },
	{ muscle: "Calves", bodyPart: "calves", level: 34, status: "low" },
];

const meta = {
	title: "Body Map/MuscleDetail",
	component: MuscleDetail,
	args: {
		fatigueData,
	},
	decorators: [
		(Story) => (
			<div style={{ margin: "0 auto", maxWidth: 420, padding: "2rem" }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof MuscleDetail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmptySelection: Story = {
	args: {
		muscleName: null,
		fatigue: null,
		side: "front",
	},
};

export const HighFatigue: Story = {
	args: {
		muscleName: "Quadriceps",
		fatigue: fatigueData[0],
		side: "front",
	},
};
