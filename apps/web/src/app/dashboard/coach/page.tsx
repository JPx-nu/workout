import { requireDashboardAccess } from "@/lib/dashboard/access";
import { loadCoachPageBootstrap } from "@/lib/dashboard/bootstraps";
import CoachPageClient from "./coach-page-client";

export default async function CoachPage() {
	const accessState = await requireDashboardAccess();
	const bootstrap = await loadCoachPageBootstrap(accessState.userId);

	return <CoachPageClient initialState={bootstrap} />;
}
