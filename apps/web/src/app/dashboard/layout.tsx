import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireAuthenticatedDashboardAccess } from "@/lib/dashboard/access";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
	const accessState = await requireAuthenticatedDashboardAccess();

	return <DashboardShell accessState={accessState}>{children}</DashboardShell>;
}
