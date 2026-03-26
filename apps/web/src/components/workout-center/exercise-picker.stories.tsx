import type { Meta, StoryObj } from "@storybook/nextjs";
import type { StrengthExerciseCatalogItem } from "@triathlon/types";
import { ExercisePicker } from "@/components/workout-center/exercise-picker";

const recentExercises: StrengthExerciseCatalogItem[] = [
	{
		id: "barbell-back-squat",
		displayName: "Barbell Back Squat",
		aliases: ["squat"],
		equipment: ["barbell"],
		movementPattern: "squat",
		primaryMuscleGroups: ["quads", "glutes"],
		catalogSource: "starter",
	},
	{
		id: "barbell-bench-press",
		displayName: "Barbell Bench Press",
		aliases: ["bench"],
		equipment: ["barbell"],
		movementPattern: "horizontal_push",
		primaryMuscleGroups: ["chest", "arms"],
		catalogSource: "starter",
	},
];

const meta = {
	title: "Workout Center/ExercisePicker",
	component: ExercisePicker,
	args: {
		open: true,
		recent: recentExercises,
		onClose: () => undefined,
		onPick: () => undefined,
	},
	parameters: {
		layout: "fullscreen",
		chromatic: {
			viewports: [390, 1280],
		},
	},
} satisfies Meta<typeof ExercisePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RecentAndLibrary: Story = {};
