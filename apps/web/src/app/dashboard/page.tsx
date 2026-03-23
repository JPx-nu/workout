import { requireDashboardAccess } from "@/lib/dashboard/access";
import { loadWorkoutsPageBootstrap } from "@/lib/dashboard/bootstraps";
import DashboardPageClient from "./dashboard-page-client";

export default async function DashboardPage() {
	const accessState = await requireDashboardAccess();
	const bootstrap = await loadWorkoutsPageBootstrap(accessState.userId);

	return <DashboardPageClient initialWorkouts={bootstrap.workouts} />;
}
