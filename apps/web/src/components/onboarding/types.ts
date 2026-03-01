export type OnboardingFocus = "triathlon" | "strength";

export type OnboardingLevel = "beginner" | "intermediate" | "advanced";

export type OnboardingDraft = {
	displayName: string;
	defaultView: OnboardingFocus | null;
	level: OnboardingLevel | null;
	primaryGoal: string | null;
};
