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
import { useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { InstallPrompt } from "@/components/install-prompt";
import { MobileNav } from "@/components/mobile-nav";
import { useAuth } from "@/components/supabase-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useProfile } from "@/hooks/use-profile";

const navItems = [
	{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/dashboard/workouts", label: "Workouts", icon: Dumbbell },
	{ href: "/dashboard/training", label: "Training", icon: Calendar },
	{ href: "/dashboard/coach", label: "AI Coach", icon: Brain },
	{ href: "/dashboard/body-map", label: "Body Map", icon: Activity },
	{ href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const { user, isLoading: authLoading, signOut } = useAuth();
	const { profile } = useProfile();
	const [collapsed, setCollapsed] = useState(false);

	// Auth guard: redirect to login if not authenticated
	useEffect(() => {
		if (!authLoading && !user) {
			router.replace("/login");
		}
	}, [authLoading, user, router]);

	// Show loading skeleton while checking auth
	if (authLoading || !user) {
		return (
			<div
				className="flex h-screen items-center justify-center"
				style={{ background: "var(--color-bg-primary)" }}
			>
				<div
					className="w-8 h-8 rounded-full border-2 animate-spin"
					style={{
						borderColor: "var(--color-glass-border)",
						borderTopColor: "var(--color-brand)",
					}}
				/>
			</div>
		);
	}

	const initials = profile.displayName
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase();

	return (
		<div className="flex h-screen overflow-hidden">
			{/* Sidebar — desktop only */}
			<aside
				className={`
        glass-sidebar hidden lg:flex fixed lg:relative z-50 h-full flex-col transition-all duration-300
        ${collapsed ? "w-[72px]" : "w-[260px]"}
      `}
			>
				{/* Logo */}
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

				{/* Nav items */}
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

				{/* Theme toggle */}
				<div className="px-3 py-2 border-t" style={{ borderColor: "var(--color-glass-border)" }}>
					<ThemeToggle collapsed={collapsed} />
				</div>

				{/* User section */}
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
								<div className="text-sm font-medium truncate">{profile.displayName}</div>
								<div className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
									{profile.clubName}
								</div>
							</div>
						)}
						{!collapsed && (
							<button
								type="button"
								onClick={signOut}
								className="shrink-0 p-1.5 rounded-lg transition-colors hover-surface"
								style={{ color: "var(--color-text-muted)" }}
								title="Sign out"
							>
								<LogOut size={14} />
							</button>
						)}
					</div>
				</div>

				{/* Collapse button (desktop only) */}
				<button
					type="button"
					onClick={() => setCollapsed(!collapsed)}
					className="hidden lg:flex items-center justify-center h-10 border-t transition-colors hover-surface"
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

			{/* Main content */}
			<main className="flex-1 overflow-y-auto">
				{/* Mobile header */}
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

			{/* PWA install prompt */}
			<InstallPrompt />

			{/* Mobile bottom tab bar */}
			<MobileNav />
		</div>
	);
}
