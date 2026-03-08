"use client";

import type { OnboardingData } from "@triathlon/types";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CoachChatStep } from "@/components/onboarding/coach-chat-step";
import { FocusStep } from "@/components/onboarding/focus-step";
import { GoalStep } from "@/components/onboarding/goal-step";
import { LevelStep } from "@/components/onboarding/level-step";
import type { OnboardingDraft, OnboardingLevel } from "@/components/onboarding/types";
import { WelcomeStep } from "@/components/onboarding/welcome-step";
import { useAuth } from "@/components/supabase-provider";
import { useProfile } from "@/hooks/use-profile";
import { getApiConfigurationError, getApiUrl } from "@/lib/constants";

const steps = ["welcome", "focus", "level", "goal", "coach"] as const;
type StepId = (typeof steps)[number];

function parseLevel(value: unknown): OnboardingLevel | null {
	return value === "beginner" || value === "intermediate" || value === "advanced" ? value : null;
}

function parseGoal(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export default function OnboardingPage() {
	const router = useRouter();
	const { user, session } = useAuth();
	const {
		profile,
		isLoading: profileLoading,
		refetch,
		updateDefaultView,
		updatePreferences,
		updateProfile,
	} = useProfile();

	const [stepIndex, setStepIndex] = useState(0);
	const [draft, setDraft] = useState<OnboardingDraft>({
		displayName: "",
		defaultView: null,
		level: null,
		primaryGoal: null,
	});
	const [hasHydratedDefaults, setHasHydratedDefaults] = useState(false);
	const [hasSeededCoach, setHasSeededCoach] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const activeStep = steps[stepIndex] as StepId;
	const progress = ((stepIndex + 1) / steps.length) * 100;

	useEffect(() => {
		if (profileLoading || hasHydratedDefaults) return;

		setDraft((prev) => ({
			...prev,
			displayName: profile.displayName || user?.email?.split("@")[0] || "Athlete",
			defaultView: profile.defaultView ?? "triathlon",
			level: parseLevel(profile.preferences.level),
			primaryGoal: parseGoal(profile.preferences.primary_goal),
		}));
		setHasHydratedDefaults(true);
	}, [profileLoading, hasHydratedDefaults, profile, user]);

	const coachSeedMessage = useMemo(() => {
		const levelText = draft.level ?? "unspecified";
		const focusText = draft.defaultView ?? "triathlon";
		const goalText = draft.primaryGoal ?? "improve overall fitness";
		return `I just signed up. My name is ${draft.displayName || "Athlete"}, I'm ${levelText}, focused on ${focusText}, and my goal is ${goalText}. Please help me finish onboarding by asking about availability, injuries, and race targets.`;
	}, [draft]);

	const goToNextStep = () => {
		setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
	};

	const goToPreviousStep = () => {
		setStepIndex((prev) => Math.max(prev - 1, 0));
	};

	const persistOnboardingDirectly = async () => {
		const nextDisplayName = draft.displayName.trim();
		const nextGoal = draft.primaryGoal?.trim();

		if (nextDisplayName && nextDisplayName !== profile.displayName) {
			await updateProfile({ displayName: nextDisplayName });
		}

		if (draft.defaultView && draft.defaultView !== profile.defaultView) {
			await updateDefaultView(draft.defaultView);
		}

		await updatePreferences({
			...(draft.level ? { level: draft.level } : {}),
			...(nextGoal ? { primary_goal: nextGoal } : {}),
			onboarding_completed: true,
		});
	};

	const completeOnboarding = async () => {
		if (isSaving) {
			return;
		}

		setIsSaving(true);
		setError(null);
		const payload: OnboardingData & {
			onboardingCompleted: boolean;
			saveMemories: boolean;
		} = {
			onboardingCompleted: true,
			saveMemories: true,
			...(draft.displayName.trim() ? { displayName: draft.displayName.trim() } : {}),
			...(draft.defaultView ? { defaultView: draft.defaultView } : {}),
			...(draft.level ? { level: draft.level } : {}),
			...(draft.primaryGoal?.trim() ? { primaryGoal: draft.primaryGoal.trim() } : {}),
		};

		try {
			const configError = getApiConfigurationError();
			if (!configError && session?.access_token) {
				const response = await fetch(getApiUrl("/api/onboarding"), {
					method: "POST",
					headers: {
						Authorization: `Bearer ${session.access_token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});

				if (!response.ok) {
					let message = "Failed to save onboarding details.";
					try {
						const data = (await response.json()) as { error?: string; detail?: string };
						message = data.detail ?? data.error ?? message;
					} catch {
						// Use fallback message when JSON parsing fails.
					}
					throw new Error(message);
				}
			} else {
				await persistOnboardingDirectly();
			}
		} catch {
			try {
				await persistOnboardingDirectly();
			} catch (fallbackErr) {
				const message =
					fallbackErr instanceof Error ? fallbackErr.message : "Failed to save onboarding details.";
				setError(message);
				setIsSaving(false);
				return;
			}
		}

		try {
			await refetch();
		} catch {
			// Redirect even if the profile refetch misses the immediate write.
		}

		setIsSaving(false);
		router.replace("/dashboard");
	};

	const handleSkip = () => {
		if (activeStep === "goal" || activeStep === "coach") {
			void completeOnboarding();
			return;
		}
		goToNextStep();
	};

	if (profileLoading) {
		return (
			<div className="flex h-[70vh] items-center justify-center">
				<div
					className="w-8 h-8 rounded-full border-2 animate-spin"
					style={{
						borderColor: "var(--color-glass-border)",
						borderTopColor: "var(--color-brand)",
					}}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
					Step {stepIndex + 1} of {steps.length}
				</div>
				<button
					type="button"
					className="btn-ghost text-xs"
					onClick={() => void completeOnboarding()}
					disabled={isSaving}
				>
					Skip all
				</button>
			</div>

			<div className="progress-bar">
				<div className="progress-bar-fill" style={{ width: `${progress}%` }} />
			</div>

			<div className="flex items-center justify-between min-h-8">
				<div>
					{stepIndex > 0 && activeStep !== "coach" && (
						<button
							type="button"
							className="btn-ghost text-sm inline-flex items-center gap-2"
							onClick={goToPreviousStep}
							disabled={isSaving}
						>
							<ArrowLeft size={14} /> Back
						</button>
					)}
				</div>
				{error && (
					<p className="text-xs text-right" style={{ color: "var(--color-danger)" }}>
						{error}
					</p>
				)}
			</div>

			<div key={activeStep} className="transition-all duration-300">
				{activeStep === "welcome" && (
					<WelcomeStep
						value={draft.displayName}
						onChange={(value) => setDraft((prev) => ({ ...prev, displayName: value }))}
						onContinue={goToNextStep}
						onSkip={handleSkip}
					/>
				)}

				{activeStep === "focus" && (
					<FocusStep
						value={draft.defaultView}
						onSelect={(value) => setDraft((prev) => ({ ...prev, defaultView: value }))}
						onContinue={goToNextStep}
						onSkip={handleSkip}
					/>
				)}

				{activeStep === "level" && (
					<LevelStep
						value={draft.level}
						onSelect={(value) => setDraft((prev) => ({ ...prev, level: value }))}
						onContinue={goToNextStep}
						onSkip={handleSkip}
					/>
				)}

				{activeStep === "goal" && (
					<GoalStep
						value={draft.primaryGoal}
						onChange={(value) => setDraft((prev) => ({ ...prev, primaryGoal: value }))}
						onContinue={goToNextStep}
						onSkip={handleSkip}
					/>
				)}

				{activeStep === "coach" && (
					<CoachChatStep
						seedMessage={coachSeedMessage}
						hasSeeded={hasSeededCoach}
						onSeeded={() => setHasSeededCoach(true)}
						onDone={() => void completeOnboarding()}
						onSkip={() => void completeOnboarding()}
						isSaving={isSaving}
					/>
				)}
			</div>
		</div>
	);
}
