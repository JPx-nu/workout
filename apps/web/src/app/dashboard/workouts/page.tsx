import { requireDashboardAccess } from "@/lib/dashboard/access";
import { loadWorkoutsPageBootstrap } from "@/lib/dashboard/bootstraps";
import WorkoutsPageClient from "./workouts-page-client";

export default async function WorkoutsPage() {
	const accessState = await requireDashboardAccess();
	const bootstrap = await loadWorkoutsPageBootstrap(accessState.userId);

	return <WorkoutsPageClient initialWorkouts={bootstrap.workouts} />;
}
