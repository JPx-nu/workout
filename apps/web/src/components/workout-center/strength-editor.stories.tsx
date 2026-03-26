import type { Meta, StoryObj } from "@storybook/nextjs";
import type { StrengthExercise } from "@triathlon/types";
import { useState } from "react";
import type { PreviousStrengthExercise } from "@/components/workout-center/model";
import { StrengthEditor } from "@/components/workout-center/strength-editor";

const seededExercises: StrengthExercise[] = [
	{
		id: "barbell-back-squat",
		catalogId: "barbell-back-squat",
		displayName: "Barbell Back Squat",
		isCustom: false,
		equipment: "barbell",
		movementPattern: "squat",
		primaryMuscleGroups: ["quads", "glutes"],
		restSec: 120,
		sets: [
			{
				id: "set-1",
				order: 1,
				setType: "working",
				completed: false,
				reps: 5,
				weightKg: 100,
				rpe: 8,
			},
			{
				id: "set-2",
				order: 2,
				setType: "working",
				completed: false,
				reps: 5,
				weightKg: 100,
				rpe: 8,
			},
		],
	},
];

const previousLookup: Record<string, PreviousStrengthExercise> = {
	"barbell-back-squat": {
		workoutId: "prior-squat-session",
		startedAt: new Date().toISOString(),
		displayName: "Barbell Back Squat",
		notes: "Last block felt smooth.",
		sets: [
			{
				id: "previous-1",
				order: 1,
				setType: "working",
				completed: true,
				reps: 5,
				weightKg: 95,
				rpe: 7.5,
			},
			{
				id: "previous-2",
				order: 2,
				setType: "working",
				completed: true,
				reps: 5,
				weightKg: 95,
				rpe: 8,
			},
		],
	},
};

const meta = {
	title: "Workout Center/StrengthEditor",
	component: StrengthEditor,
	render: (args) => {
		const [exercises, setExercises] = useState(args.exercises);

		return (
			<div style={{ margin: "0 auto", maxWidth: 1100, padding: "2rem" }}>
				<StrengthEditor {...args} exercises={exercises} onChange={setExercises} />
			</div>
		);
	},
	args: {
		mode: "schedule",
		exercises: [],
		previousLookup: {},
		onOpenPicker: () => undefined,
		onStartRest: () => undefined,
	},
	parameters: {
		chromatic: {
			viewports: [390, 1280],
		},
	},
} satisfies Meta<typeof StrengthEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {};

export const PopulatedSession: Story = {
	args: {
		exercises: seededExercises,
		previousLookup,
	},
};
