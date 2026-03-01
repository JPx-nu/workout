"use client";

import { ArrowRight, UserRound } from "lucide-react";

type WelcomeStepProps = {
	value: string;
	onChange: (value: string) => void;
	onContinue: () => void;
	onSkip: () => void;
};

export function WelcomeStep({ value, onChange, onContinue, onSkip }: WelcomeStepProps) {
	return (
		<div className="glass-card p-6 lg:p-8 animate-fade-in">
			<div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-primary/10">
				<UserRound size={22} style={{ color: "var(--color-brand)" }} />
			</div>
			<h1 className="text-2xl font-bold">Welcome to Triathlon AI</h1>
			<p className="text-sm mt-2 mb-6" style={{ color: "var(--color-text-secondary)" }}>
				Let's personalize your training in under a minute. You can skip any step.
			</p>

			<label
				htmlFor="onboarding-display-name"
				className="text-xs font-medium block mb-2"
				style={{ color: "var(--color-text-muted)" }}
			>
				What should we call you?
			</label>
			<input
				id="onboarding-display-name"
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Your name"
				className="glass-input w-full"
			/>

			<div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
				<button type="button" className="btn-ghost text-sm" onClick={onSkip}>
					Skip
				</button>
				<button
					type="button"
					onClick={onContinue}
					className="btn-primary text-sm inline-flex items-center justify-center gap-2"
				>
					Continue <ArrowRight size={14} />
				</button>
			</div>
		</div>
	);
}
