import { requireDashboardAccess } from "@/lib/dashboard/access";
import SettingsPageClient from "./settings-page-client";

export default async function SettingsPage() {
	await requireDashboardAccess();

	return <SettingsPageClient />;
}
