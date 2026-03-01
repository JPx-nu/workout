"use client";

import { ArrowRight, Target } from "lucide-react";
import { useMemo } from "react";

type GoalStepProps = {
	value: string | null;
	onChange: (value: string) => void;
	onContinue: () => void;
	onSkip: () => void;
};

const goalOptions = [
	"Complete my first triathlon",
	"Prepare for an Ironman 70.3 / Ironman",
	"Build strength and muscle",
	"Improve body composition",
	"General fitness and consistency",
];

export function GoalStep({ value, onChange, onContinue, onSkip }: GoalStepProps) {
	const isCustomGoal = useMemo(() => Boolean(value) && !goalOptions.includes(value ?? ""), [value]);

	return (
		<div className="glass-card p-6 lg:p-8 animate-fade-in">
			<div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-primary/10">
				<Target size={22} style={{ color: "var(--color-brand)" }} />
			</div>
			<h2 className="text-xl font-bold">What is your primary goal right now?</h2>
			<p className="text-sm mt-2 mb-6" style={{ color: "var(--color-text-secondary)" }}>
				Your coach and training plan will center around this.
			</p>

			<div className="space-y-3">
				{goalOptions.map((goal) => (
					<button
						key={goal}
						type="button"
						onClick={() => onChange(goal)}
						className="w-full text-left p-4 rounded-xl border transition-colors hover-surface"
						style={{
							borderColor: value === goal ? "var(--color-brand)" : "var(--color-glass-border)",
							background:
								value === goal ? "oklch(from var(--color-brand) l c h / 0.12)" : "transparent",
						}}
					>
						<span className="text-sm font-medium">{goal}</span>
					</button>
				))}
			</div>

			<div className="mt-4">
				<label
					htmlFor="onboarding-custom-goal"
					className="text-xs font-medium block mb-2"
					style={{ color: "var(--color-text-muted)" }}
				>
					Other goal (optional)
				</label>
				<input
					id="onboarding-custom-goal"
					type="text"
					value={isCustomGoal ? (value ?? "") : ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Describe your goal"
					className="glass-input w-full"
				/>
			</div>

			<div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
				<button type="button" className="btn-ghost text-sm" onClick={onSkip}>
					Skip
				</button>
				<button
					type="button"
					onClick={onContinue}
					disabled={!value?.trim()}
					className="btn-primary text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					Continue <ArrowRight size={14} />
				</button>
			</div>
		</div>
	);
}
