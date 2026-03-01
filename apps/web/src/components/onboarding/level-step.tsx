"use client";

import { ArrowRight } from "lucide-react";
import type { OnboardingLevel } from "./types";

type LevelStepProps = {
	value: OnboardingLevel | null;
	onSelect: (value: OnboardingLevel) => void;
	onContinue: () => void;
	onSkip: () => void;
};

const options: Array<{
	value: OnboardingLevel;
	title: string;
	description: string;
}> = [
	{
		value: "beginner",
		title: "Beginner",
		description: "Just getting started or returning after time off.",
	},
	{
		value: "intermediate",
		title: "Intermediate",
		description: "Training consistently and comfortable with structured sessions.",
	},
	{
		value: "advanced",
		title: "Advanced",
		description: "Experienced athlete aiming for performance gains.",
	},
];

export function LevelStep({ value, onSelect, onContinue, onSkip }: LevelStepProps) {
	return (
		<div className="glass-card p-6 lg:p-8 animate-fade-in">
			<h2 className="text-xl font-bold">What is your current level?</h2>
			<p className="text-sm mt-2 mb-6" style={{ color: "var(--color-text-secondary)" }}>
				This helps calibrate intensity, coaching style, and recommendations.
			</p>

			<div className="space-y-3">
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => onSelect(option.value)}
						className="w-full text-left p-4 rounded-xl border transition-colors hover-surface"
						style={{
							borderColor:
								value === option.value ? "var(--color-brand)" : "var(--color-glass-border)",
							background:
								value === option.value
									? "oklch(from var(--color-brand) l c h / 0.12)"
									: "transparent",
						}}
					>
						<div className="font-semibold text-sm">{option.title}</div>
						<div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
							{option.description}
						</div>
					</button>
				))}
			</div>

			<div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
				<button type="button" className="btn-ghost text-sm" onClick={onSkip}>
					Skip
				</button>
				<button
					type="button"
					onClick={onContinue}
					disabled={!value}
					className="btn-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					Continue <ArrowRight size={14} />
				</button>
			</div>
		</div>
	);
}
