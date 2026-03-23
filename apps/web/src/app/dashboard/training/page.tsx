import { requireDashboardAccess } from "@/lib/dashboard/access";
import TrainingPageClient from "./training-page-client";

export default async function TrainingPage() {
	await requireDashboardAccess();

	return <TrainingPageClient />;
}
