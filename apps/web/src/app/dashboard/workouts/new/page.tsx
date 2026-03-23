import type { ActivityType } from "@triathlon/types";
import { requireDashboardAccess } from "@/lib/dashboard/access";
import { loadWorkoutCenterBootstrap } from "@/lib/dashboard/bootstraps";
import NewWorkoutPageClient from "./new-workout-page-client";

type NewWorkoutPageSearchParams = Promise<{
	mode?: string | string[];
	activity?: string | string[];
	plannedWorkoutId?: string | string[];
	workoutId?: string | string[];
}>;

function getSingleValue(value: string | string[] | undefined): string | null {
	if (typeof value === "string") {
		return value;
	}

	return value?.[0] ?? null;
}

function parseMode(value: string | null): "start_now" | "log_past" | "schedule" {
	if (value === "start" || value === "start_now") return "start_now";
	if (value === "schedule") return "schedule";
	return "log_past";
}

function parseActivity(value: string | null): ActivityType {
	return value === "RUN" ||
		value === "BIKE" ||
		value === "SWIM" ||
		value === "STRENGTH" ||
		value === "YOGA" ||
		value === "OTHER"
		? value
		: "STRENGTH";
}

export default async function NewWorkoutPage({
	searchParams,
}: {
	searchParams: NewWorkoutPageSearchParams;
}) {
	const accessState = await requireDashboardAccess();
	const params = await searchParams;
	const bootstrap = await loadWorkoutCenterBootstrap(accessState.userId);

	return (
		<NewWorkoutPageClient
			initialMode={parseMode(getSingleValue(params.mode))}
			initialActivity={parseActivity(getSingleValue(params.activity))}
			requestedPlannedId={getSingleValue(params.plannedWorkoutId)}
			requestedWorkoutId={getSingleValue(params.workoutId)}
			bootstrap={bootstrap}
		/>
	);
}
