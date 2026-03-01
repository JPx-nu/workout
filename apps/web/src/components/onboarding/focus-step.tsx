"use client";

import { ArrowRight, Bike, Dumbbell, Footprints, Waves } from "lucide-react";
import type { OnboardingFocus } from "./types";

type FocusStepProps = {
	value: OnboardingFocus | null;
	onSelect: (value: OnboardingFocus) => void;
	onContinue: () => void;
	onSkip: () => void;
};

export function FocusStep({ value, onSelect, onContinue, onSkip }: FocusStepProps) {
	return (
		<div className="glass-card p-6 lg:p-8 animate-fade-in">
			<h2 className="text-xl font-bold">What should your dashboard focus on?</h2>
			<p className="text-sm mt-2 mb-6" style={{ color: "var(--color-text-secondary)" }}>
				Choose the view that best matches your current training priority.
			</p>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<button
					type="button"
					onClick={() => onSelect("triathlon")}
					className="glass-card text-left p-5"
					style={{
						borderColor:
							value === "triathlon" ? "oklch(0.65 0.15 220 / 0.65)" : "var(--color-glass-border)",
					}}
				>
					<div className="flex items-center gap-2 mb-3">
						<Waves size={16} style={{ color: "var(--color-swim)" }} />
						<Bike size={16} style={{ color: "var(--color-bike)" }} />
						<Footprints size={16} style={{ color: "var(--color-run)" }} />
					</div>
					<div className="font-semibold text-sm">Triathlon</div>
					<div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
						Swim, bike, and run readiness + volume
					</div>
				</button>

				<button
					type="button"
					onClick={() => onSelect("strength")}
					className="glass-card text-left p-5"
					style={{
						borderColor:
							value === "strength" ? "oklch(0.65 0.12 310 / 0.65)" : "var(--color-glass-border)",
					}}
				>
					<div className="flex items-center gap-2 mb-3">
						<Dumbbell size={16} style={{ color: "var(--color-strength)" }} />
					</div>
					<div className="font-semibold text-sm">Strength</div>
					<div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
						Volume, density, PR tracking, and recovery
					</div>
				</button>
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
