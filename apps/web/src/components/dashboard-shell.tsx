"use client";

import {
	Activity,
	Brain,
	Calendar,
	ChevronLeft,
	Dumbbell,
	LayoutDashboard,
	LogOut,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { DashboardAccessProvider } from "@/components/dashboard-access-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileNav } from "@/components/mobile-nav";
import { useAuth } from "@/components/supabase-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import type { DashboardAccessState } from "@/lib/dashboard/types";

const navItems = [
	{ href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
	{ href: "/dashboard/workouts" as const, label: "Workouts", icon: Dumbbell },
	{ href: "/dashboard/training" as const, label: "Training", icon: Calendar },
	{ href: "/dashboard/coach" as const, label: "AI Coach", icon: Brain },
	{ href: "/dashboard/body-map" as const, label: "Body Map", icon: Activity },
	{ href: "/dashboard/settings" as const, label: "Settings", icon: Settings },
];

export function DashboardShell({
	accessState,
	children,
}: {
	accessState: DashboardAccessState;
	children: ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const { signOut } = useAuth();
	const [collapsed, setCollapsed] = useState(false);
	const isOnboardingRoute = pathname.startsWith("/dashboard/onboarding");
	const initials = accessState.displayName
		.split(" ")
		.map((name) => name[0])
		.join("")
		.toUpperCase();

	async function handleSignOut() {
		await signOut();
		router.replace("/login");
		router.refresh();
	}

	if (isOnboardingRoute) {
		return (
			<DashboardAccessProvider value={accessState}>
				<div className="min-h-screen" style={{ background: "var(--color-bg-primary)" }}>
					<ErrorBoundary>{children}</ErrorBoundary>
				</div>
			</DashboardAccessProvider>
		);
	}

	return (
		<DashboardAccessProvider value={accessState}>
			<div className="flex h-screen overflow-hidden">
				<aside
					className={`
						glass-sidebar hidden lg:flex fixed lg:relative z-50 h-full flex-col transition-all duration-300
						${collapsed ? "w-[72px]" : "w-[260px]"}
					`}
				>
					<div className="flex items-center gap-3 px-5 h-16 shrink-0">
						<div
							className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
							style={{
								background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
							}}
						>
							TRI
						</div>
						{!collapsed && (
							<span className="font-semibold text-sm tracking-tight animate-fade-in">
								Triathlon AI
							</span>
						)}
					</div>

					<nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
						{navItems.map(({ href, label, icon: Icon }) => {
							const isActive =
								pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
							return (
								<Link
									key={href}
									href={href}
									className={`
										flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
										${isActive ? "text-white" : "hover-surface"}
									`}
									style={
										isActive
											? {
													background:
														"linear-gradient(135deg, oklch(0.65 0.18 170 / 0.2), oklch(0.65 0.18 170 / 0.08))",
													color: "var(--color-brand-light)",
													boxShadow: "inset 0 0 0 1px oklch(0.65 0.18 170 / 0.15)",
												}
											: { color: "var(--color-text-secondary)" }
									}
								>
									<Icon size={18} className="shrink-0" />
									{!collapsed && <span>{label}</span>}
								</Link>
							);
						})}
					</nav>

					<div className="px-3 py-2 border-t" style={{ borderColor: "var(--color-glass-border)" }}>
						<ThemeToggle collapsed={collapsed} />
					</div>

					<div className="px-3 py-4 border-t" style={{ borderColor: "var(--color-glass-border)" }}>
						<div className="flex items-center gap-3 px-3 py-2">
							<div
								className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
								style={{
									background: "linear-gradient(135deg, var(--color-swim), var(--color-brand))",
								}}
							>
								{initials}
							</div>
							{!collapsed && (
								<div className="min-w-0 flex-1 animate-fade-in">
									<div className="text-sm font-medium truncate">{accessState.displayName}</div>
									<div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
										{accessState.clubName}
									</div>
								</div>
							)}
							{!collapsed && (
								<button
									type="button"
									onClick={() => void handleSignOut()}
									className="shrink-0 p-1.5 rounded-lg transition-colors hover-surface"
									style={{ color: "var(--color-text-muted)" }}
									title="Sign out"
								>
									<LogOut size={14} />
								</button>
							)}
						</div>
					</div>

					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="hidden lg:flex items-center justify-center h-10 border-t transition-colors hover-surface"
						aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
						style={{
							borderColor: "var(--color-glass-border)",
							color: "var(--color-text-muted)",
						}}
					>
						<ChevronLeft
							size={16}
							className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
						/>
					</button>
				</aside>

				<main className="flex-1 overflow-y-auto">
					<div
						className="lg:hidden flex items-center justify-center px-4 h-12 border-b"
						style={{
							borderColor: "var(--color-glass-border)",
							paddingTop: "env(safe-area-inset-top, 0px)",
						}}
					>
						<span className="font-semibold text-sm">Triathlon AI</span>
					</div>

					<ErrorBoundary>
						<div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto">{children}</div>
					</ErrorBoundary>
				</main>

				<InstallPrompt />
				<MobileNav />
			</div>
		</DashboardAccessProvider>
	);
}
