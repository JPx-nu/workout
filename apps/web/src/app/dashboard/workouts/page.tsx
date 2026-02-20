"use client";

import { Bike, Dumbbell, Filter, Footprints, Waves } from "lucide-react";
import {
	formatDuration,
	formatPace,
	mToKm,
	useWorkouts,
} from "@/hooks/use-workouts";

const activityIcons: Record<string, typeof Waves> = {
	SWIM: Waves,
	BIKE: Bike,
	RUN: Footprints,
	STRENGTH: Dumbbell,
};

const activityColors: Record<string, string> = {
	SWIM: "var(--color-swim)",
	BIKE: "var(--color-bike)",
	RUN: "var(--color-run)",
	STRENGTH: "var(--color-strength)",
};

const badgeClasses: Record<string, string> = {
	SWIM: "badge-swim",
	BIKE: "badge-bike",
	RUN: "badge-run",
	STRENGTH: "badge-strength",
};

export default function WorkoutsPage() {
	const { workouts, allWorkouts, filter, setFilter } = useWorkouts();

	return (
		<div className="space-y-6 animate-fade-in">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Workouts</h1>
					<p
						className="mt-1 text-sm"
						style={{ color: "var(--color-text-secondary)" }}
					>
						{allWorkouts.length} workouts recorded
					</p>
				</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-2 overflow-x-auto py-2 -mx-2 px-2 scrollbar-hide">
				{(["ALL", "SWIM", "BIKE", "RUN", "STRENGTH"] as const).map((type) => {
					const isActive = filter === type;
					const Icon = type === "ALL" ? Filter : activityIcons[type];
					return (
						<button
							key={type}
							onClick={() => setFilter(type)}
							className={`badge transition-all cursor-pointer ${type !== "ALL" ? badgeClasses[type] : ""}`}
							style={
								isActive
									? {
											background:
												type === "ALL"
													? "oklch(0.65 0.18 170 / 0.2)"
													: undefined,
											boxShadow: "0 0 0 1px currentColor",
										}
									: type === "ALL"
										? {
												background: "var(--color-glass-bg-subtle)",
												color: "var(--color-text-secondary)",
											}
										: { opacity: 0.5 }
							}
						>
							<Icon size={12} />{" "}
							{type === "ALL"
								? "All"
								: type.charAt(0) + type.slice(1).toLowerCase()}
						</button>
					);
				})}
			</div>

			{/* Workout list */}
			<div className="space-y-3 stagger-children">
				{workouts.map((w) => {
					const Icon = activityIcons[w.activityType] ?? Dumbbell;
					const color = activityColors[w.activityType];

					return (
						<div key={w.id} className="glass-card p-4 lg:p-5">
							<div className="flex items-start gap-3 lg:gap-4">
								<div
									className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
									style={{
										background: `color-mix(in oklch, ${color}, transparent 80%)`,
									}}
								>
									<Icon size={20} style={{ color }} />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<span className={`badge ${badgeClasses[w.activityType]}`}>
											{w.activityType}
										</span>
										<span
											className="text-xs"
											style={{ color: "var(--color-text-muted)" }}
										>
											via {w.source}
										</span>
									</div>
									<div className="text-sm font-medium">{w.notes}</div>
									<div
										className="text-xs mt-1"
										style={{ color: "var(--color-text-muted)" }}
									>
										{new Date(w.startedAt).toLocaleDateString("en-US", {
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</div>
								</div>

								{/* Stats */}
								<div className="hidden sm:flex gap-6 shrink-0 text-right">
									<div>
										<div className="text-sm font-semibold">
											{formatDuration(w.durationSec)}
										</div>
										<div
											className="text-xs"
											style={{ color: "var(--color-text-muted)" }}
										>
											Duration
										</div>
									</div>
									{w.distanceM && (
										<div>
											<div className="text-sm font-semibold">
												{mToKm(w.distanceM)} km
											</div>
											<div
												className="text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												Distance
											</div>
										</div>
									)}
									{w.avgHr && (
										<div>
											<div className="text-sm font-semibold">{w.avgHr} bpm</div>
											<div
												className="text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												Avg HR
											</div>
										</div>
									)}
									{w.tss && (
										<div>
											<div className="text-sm font-semibold">{w.tss}</div>
											<div
												className="text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												TSS
											</div>
										</div>
									)}
									{w.distanceM && w.activityType === "RUN" && (
										<div>
											<div className="text-sm font-semibold">
												{formatPace(w.durationSec, w.distanceM)}
											</div>
											<div
												className="text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												Pace
											</div>
										</div>
									)}
								</div>
							</div>
							{/* Mobile stats row */}
							<div
								className="flex sm:hidden gap-4 mt-3 pt-3 border-t overflow-x-auto"
								style={{ borderColor: "var(--color-glass-border)" }}
							>
								<div className="shrink-0">
									<div className="text-sm font-semibold">
										{formatDuration(w.durationSec)}
									</div>
									<div
										className="text-[10px]"
										style={{ color: "var(--color-text-muted)" }}
									>
										Duration
									</div>
								</div>
								{w.distanceM && (
									<div className="shrink-0">
										<div className="text-sm font-semibold">
											{mToKm(w.distanceM)} km
										</div>
										<div
											className="text-[10px]"
											style={{ color: "var(--color-text-muted)" }}
										>
											Distance
										</div>
									</div>
								)}
								{w.avgHr && (
									<div className="shrink-0">
										<div className="text-sm font-semibold">{w.avgHr} bpm</div>
										<div
											className="text-[10px]"
											style={{ color: "var(--color-text-muted)" }}
										>
											HR
										</div>
									</div>
								)}
								{w.tss && (
									<div className="shrink-0">
										<div className="text-sm font-semibold">{w.tss}</div>
										<div
											className="text-[10px]"
											style={{ color: "var(--color-text-muted)" }}
										>
											TSS
										</div>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
