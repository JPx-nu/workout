import { requireDashboardAccess } from "@/lib/dashboard/access";
import BodyMap3DPageClient from "./body-map-3d-page-client";

export default async function BodyMap3DPage() {
	await requireDashboardAccess();

	return <BodyMap3DPageClient />;
}
