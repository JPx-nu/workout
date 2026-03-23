import { requireDashboardAccess } from "@/lib/dashboard/access";
import BodyMapPageClient from "./body-map-page-client";

export default async function BodyMapPage() {
	await requireDashboardAccess();

	return <BodyMapPageClient />;
}
