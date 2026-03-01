"use client";

import { formatDuration } from "@triathlon/core";
import { Activity, ChevronRight, Dumbbell, Timer, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SpotlightCard } from "@/components/spotlight-card";
import type { StrengthSessionData, Workout } from "@/lib/types";

// Reusing types from hook
type StrengthMetrics = {
	weeklyVolumeLoad: number;
	avgDensity: number;
	muscleSplit: Record<string, number>;
};

interface StrengthViewProps {
	workouts: Workout[];
	metrics: StrengthMetrics;
}

export function StrengthView({ workouts, metrics }: StrengthViewProps) {
	const recentWorkouts = workouts.slice(0, 5);

	// Calculate chart data (Volume per day)
	const chartData = [1, 2, 3, 4, 5, 6, 0].map((offset) => {
		const d = new Date();
		d.setDate(d.getDate() - (6 - offset));
		const dayStr = d.toISOString().split("T")[0];
		const dayWorkouts = workouts.filter((w) => w.startedAt.startsWith(dayStr));

		// Calculate daily volume
		const volume = dayWorkouts.reduce((acc, w) => {
			const data = w.rawData as StrengthSessionData | undefined;
			if (!data) return acc;
			const sessionVol = data.exercises.reduce(
				(sAcc, ex) => sAcc + ex.sets.reduce((setAcc, s) => setAcc + s.weightKg * s.reps, 0),
				0,
			);
			return acc + sessionVol;
		}, 0);

		return {
			day: d.toLocaleDateString("en-US", { weekday: "short" }),
			volume,
		};
	});

	const stats = [
		{
			label: "Weekly Volume",
			value: `${(metrics.weeklyVolumeLoad / 1000).toFixed(1)}k kg`,
			icon: Dumbbell,
			color: "var(--color-strength)",
		},
		{
			label: "Workouts",
			value: workouts.length.toString(),
			sub: "This week",
			icon: Activity,
			color: "var(--color-brand-light)",
		},
		{
			label: "Avg Density",
			value: `${metrics.avgDensity}`,
			sub: "kg/min",
			icon: Timer,
			color: "oklch(0.7 0.15 150)",
		},
		{
			label: "Est. 1RM",
			value: "145 kg", // Mock for now, would be calculated from best set
			sub: "Squat (All time)",
			icon: TrendingUp,
			color: "oklch(0.65 0.18 30)",
		},
	];

	// Muscle Split Data
	const muscles = Object.entries(metrics.muscleSplit)
		.sort(([, a], [, b]) => b - a)
		.map(([name, count]) => ({ name, count }));
	const maxSets = Math.max(...muscles.map((m) => m.count), 1);

	return (
		<div className="space-y-6 animate-fade-in">
			{/* KPI Cards */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 stagger-children">
				{stats.map((stat) => (
					<SpotlightCard key={stat.label} className="p-4 lg:p-5">
						<div className="flex items-center justify-between mb-3">
							<span
								className="badge"
								style={{
									background: `color-mix(in oklch, ${stat.color}, transparent 85%)`,
									color: stat.color,
								}}
							>
								<stat.icon size={12} /> {stat.label}
							</span>
						</div>
						<div className="text-xl lg:text-2xl font-bold">{stat.value}</div>
						{stat.sub && (
							<div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
								{stat.sub}
							</div>
						)}
					</SpotlightCard>
				))}
			</div>

			{/* Main Content Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
				{/* Volume Chart */}
				<SpotlightCard className="p-4 lg:p-6 lg:col-span-2">
					<h3
						className="text-sm font-semibold mb-4"
						style={{ color: "var(--color-text-secondary)" }}
					>
						Volume Load (Daily)
					</h3>
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={chartData} barGap={2}>
								<XAxis
									dataKey="day"
									tick={{ fill: "oklch(0.5 0.01 260)", fontSize: 12 }}
									axisLine={false}
									tickLine={false}
								/>
								<YAxis
									tick={{ fill: "oklch(0.5 0.01 260)", fontSize: 12 }}
									axisLine={false}
									tickLine={false}
									width={40}
									tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
								/>
								<Tooltip
									contentStyle={{
										background: "var(--color-glass-bg-subtle)",
										border: "1px solid var(--color-glass-border)",
										borderRadius: "0.75rem",
										color: "var(--color-text-primary)",
										backdropFilter: "blur(12px)",
									}}
									formatter={(val: number | undefined) => [val ? `${val} kg` : "0 kg", "Volume"]}
								/>
								<Bar dataKey="volume" radius={[4, 4, 0, 0]}>
									{chartData.map((entry) => (
										<Cell
											key={`cell-${entry.day}`}
											fill="var(--color-strength)"
											opacity={entry.volume > 0 ? 0.8 : 0.1}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</SpotlightCard>

				{/* Sidebar: Muscle Split */}
				<div className="space-y-6">
					<div className="glass-card p-4 lg:p-6">
						<h3
							className="text-sm font-semibold mb-4"
							style={{ color: "var(--color-text-secondary)" }}
						>
							Muscle Focus (Sets)
						</h3>
						<div className="space-y-3">
							{muscles.length === 0 ? (
								<div className="text-sm text-center py-4 text-muted">No data this week</div>
							) : (
								muscles.map((m) => (
									<div key={m.name} className="space-y-1">
										<div className="flex justify-between text-xs font-medium">
											<span className="capitalize">{m.name}</span>
											<span>{m.count} sets</span>
										</div>
										<div className="h-2 rounded-full overflow-hidden bg-white/5">
											<div
												className="h-full rounded-full transition-all duration-500"
												style={{
													width: `${(m.count / maxSets) * 100}%`,
													background: "var(--color-strength)",
												}}
											/>
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* Quick Add? Or PRs? */}
					<div className="glass-card p-5 flex items-center justify-between">
						<div className="text-sm font-medium">Log Workout</div>
						<Link href="/dashboard/workouts/new" className="btn-primary text-xs px-3 py-1.5 h-auto">
							+ New
						</Link>
					</div>
				</div>
			</div>

			{/* Recent Workouts List (Detailed) */}
			<div className="glass-card p-4 lg:p-6">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
						Recent Workouts
					</h3>
					<Link
						href="/dashboard/workouts"
						className="text-xs font-medium flex items-center gap-1"
						style={{ color: "var(--color-brand-light)" }}
					>
						View all <ChevronRight size={14} />
					</Link>
				</div>
				<div className="space-y-3">
					{recentWorkouts.map((w) => {
						const data = w.rawData as StrengthSessionData | undefined;
						const volume =
							data?.exercises.reduce(
								(act, ex) => act + ex.sets.reduce((sact, s) => sact + s.weightKg * s.reps, 0),
								0,
							) || 0;
						const exerciseCount = data?.exercises.length || 0;

						return (
							<div
								key={w.id}
								className="flex items-center gap-4 p-3 rounded-xl transition-colors hover-surface"
							>
								<div
									className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
									style={{
										background: "color-mix(in oklch, var(--color-strength), transparent 85%)",
									}}
								>
									<Dumbbell size={18} style={{ color: "var(--color-strength)" }} />
								</div>
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium truncate">
										{data?.focus || w.notes || "Strength Session"}
									</div>
									<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
										{new Date(w.startedAt).toLocaleDateString("en-US", {
											weekday: "short",
											month: "short",
											day: "numeric",
										})}
										{" · "} {exerciseCount} exercises
									</div>
								</div>
								<div className="text-right shrink-0">
									<div className="text-sm font-medium">{formatDuration(w.durationSec)}</div>
									<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
										{volume > 0 ? `${(volume / 1000).toFixed(1)}k kg` : "—"}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
