"use client";

import { useHealth } from "@/hooks/use-health";
import { useProfile } from "@/hooks/use-profile";
import { useTraining } from "@/hooks/use-training";
import { useWorkouts } from "@/hooks/use-workouts";
import { StrengthView } from "./components/strength-view";
import { TriathlonView } from "./components/triathlon-view";

export default function DashboardPage() {
	const { profile } = useProfile();
	const { weeklyStats, chartData, allWorkouts, strengthMetrics } = useWorkouts();
	const { events } = useTraining();
	const { healthSnapshot } = useHealth();

	const firstName = profile.displayName.split(" ")[0];

	// Determine which view to show
	const isStrengthView = profile.defaultView === "strength";

	return (
		<div className="space-y-8 animate-fade-in">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-bold">Good morning, {firstName} 👋</h1>
				<p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
					{isStrengthView
						? "Ready to build some power today?"
						: `Week 6 of your Ironman 70.3 build. ${weeklyStats.totalTSS} TSS this week.`}
				</p>
			</div>

			{/* View Switcher is handled in Settings or could be a toggle here */}

			{isStrengthView ? (
				<StrengthView
					workouts={allWorkouts} // Passed all, component filters
					metrics={strengthMetrics}
				/>
			) : (
				<TriathlonView
					weeklyStats={weeklyStats}
					chartData={chartData}
					healthSnapshot={healthSnapshot}
					events={events}
					allWorkouts={allWorkouts}
				/>
			)}
		</div>
	);
}
