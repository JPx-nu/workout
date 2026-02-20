"use client";

import { useCallback, useMemo, useState } from "react";
import Model, {
	type IExerciseData,
	type IMuscleStats,
} from "react-body-highlighter";
import type { MuscleFatigue } from "@/lib/mock/health";
import MuscleDetail from "./MuscleDetail";
import {
	fatigueToLibMuscles,
	libMuscleLabels,
	libMuscleToBodyPart,
} from "./muscle-paths";

/* ═══════════════════════════════════════════════════
   Convert fatigue data to library format.
   
   The library colors muscles by "frequency" (1–N) mapped to
   the `highlightedColors` array index. We bucket our 0-100
   fatigue levels into 3 tiers:
     1 = low    (0-39)   → green
     2 = moderate (40-69) → amber  
     3 = high   (70-100)  → red
   ═══════════════════════════════════════════════════ */
function fatigueToFrequency(level: number): number {
	if (level >= 70) return 3;
	if (level >= 40) return 2;
	return 1;
}

function buildExerciseData(fatigueData: MuscleFatigue[]): IExerciseData[] {
	return fatigueData.flatMap((f) => {
		const libMuscles = fatigueToLibMuscles[f.bodyPart];
		if (!libMuscles) return [];
		return libMuscles.map((muscle) => ({
			name: f.muscle,
			muscles: [muscle],
			frequency: fatigueToFrequency(f.level),
		}));
	});
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function BodySvg({
	fatigueData,
}: {
	fatigueData: MuscleFatigue[];
}) {
	const [side, setSide] = useState<"anterior" | "posterior">("anterior");
	const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

	const exerciseData = useMemo(
		() => buildExerciseData(fatigueData),
		[fatigueData],
	);

	const handleClick = useCallback((data: IMuscleStats) => {
		setSelectedMuscle((prev) => (prev === data.muscle ? null : data.muscle));
	}, []);

	// Find fatigue for selected muscle
	const selectedFatigue = useMemo(() => {
		if (!selectedMuscle) return null;
		const bodyPart = libMuscleToBodyPart[selectedMuscle];
		if (!bodyPart) return null;
		return fatigueData.find((f) => f.bodyPart === bodyPart) ?? null;
	}, [selectedMuscle, fatigueData]);

	const selectedLabel = selectedMuscle
		? (libMuscleLabels[selectedMuscle] ?? selectedMuscle)
		: null;

	return (
		<div className="flex flex-col lg:flex-row gap-6 w-full items-start">
			{/* ── Body Model Column ── */}
			<div className="flex-1 flex flex-col items-center gap-5">
				{/* Front / Back toggle */}
				<div
					className="inline-flex rounded-full p-1 gap-0.5"
					style={{
						background: "var(--color-glass-bg)",
						border: "1px solid var(--color-border)",
					}}
				>
					{[
						{ key: "anterior" as const, label: "Front" },
						{ key: "posterior" as const, label: "Back" },
					].map(({ key, label }) => (
						<button
							key={key}
							onClick={() => {
								setSide(key);
								setSelectedMuscle(null);
							}}
							className="px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200"
							style={{
								background:
									side === key
										? "linear-gradient(135deg, var(--color-accent), color-mix(in oklch, var(--color-accent), black 20%))"
										: "transparent",
								color: side === key ? "#fff" : "var(--color-text-muted)",
								boxShadow: side === key ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
							}}
						>
							{label}
						</button>
					))}
				</div>

				{/* Body model */}
				<div className="relative w-full max-w-[340px] mx-auto body-map-container">
					<Model
						data={exerciseData}
						style={{ width: "100%", padding: "0" }}
						svgStyle={{ maxHeight: "62vh" }}
						bodyColor="rgba(255,255,255,0.18)"
						highlightedColors={[
							"#22c55e", // frequency 1 = low (green)
							"#f59e0b", // frequency 2 = moderate (amber)
							"#ef4444", // frequency 3 = high (red)
						]}
						onClick={handleClick}
						type={side}
					/>
				</div>

				{/* Legend */}
				<div
					className="flex items-center gap-6 text-xs"
					style={{ color: "var(--color-text-muted)" }}
				>
					{[
						{ label: "Low", color: "#22c55e" },
						{ label: "Moderate", color: "#f59e0b" },
						{ label: "High", color: "#ef4444" },
					].map(({ label, color }) => (
						<span key={label} className="flex items-center gap-1.5">
							<span
								className="w-3 h-3 rounded-full"
								style={{ background: color }}
							/>
							{label}
						</span>
					))}
				</div>
			</div>

			{/* ── Detail Panel ── */}
			<div className="w-full lg:w-80 lg:sticky lg:top-6">
				<MuscleDetail
					muscleName={selectedLabel}
					fatigue={selectedFatigue}
					fatigueData={fatigueData}
					side={side === "anterior" ? "front" : "back"}
				/>
			</div>
		</div>
	);
}
