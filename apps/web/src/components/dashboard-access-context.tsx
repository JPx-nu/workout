"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { DashboardAccessState } from "@/lib/dashboard/types";

const DashboardAccessContext = createContext<DashboardAccessState | null>(null);

export function DashboardAccessProvider({
	children,
	value,
}: {
	children: ReactNode;
	value: DashboardAccessState;
}) {
	return (
		<DashboardAccessContext.Provider value={value}>{children}</DashboardAccessContext.Provider>
	);
}

export function useDashboardAccess() {
	return useContext(DashboardAccessContext);
}
