// Re-export from @triathlon/core — single source of truth

export type { ExerciseData, ExerciseSummary, SetData } from "@triathlon/core";
export {
	computeAverageRPE,
	computeSessionVolume,
	computeVolume,
	estimate1RM,
	findTopSet,
	summarizeStrengthWorkout,
} from "@triathlon/core";
