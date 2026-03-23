import type { MappedPlannedWorkout, MappedWorkout } from "@triathlon/core";
import type { AppProfile } from "@triathlon/types";

export type DashboardAccessState = {
	userId: string;
	email: string;
	displayName: string;
	clubName: string;
	defaultView: AppProfile["defaultView"];
	isOnboarded: boolean;
	profile: AppProfile;
};

export type CoachConversationSummary = {
	id: string;
	title: string | null;
	created_at: string;
	message_count: number;
};

export type CoachPageBootstrap = {
	conversations: CoachConversationSummary[];
};

export type WorkoutsPageBootstrap = {
	workouts: MappedWorkout[];
};

export type WorkoutCenterBootstrap = {
	allWorkouts: MappedWorkout[];
	draftSessions: MappedPlannedWorkout[];
	plannedSessions: MappedPlannedWorkout[];
};
