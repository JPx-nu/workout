import { Activity, Bike, Dumbbell, Footprints, Waves, Zap } from "lucide-react";

export type ActivityMeta = {
	icon: typeof Waves;
	color: string;
	cssColor: string;
	lightBg: string;
	darkBg: string;
	lightText: string;
	darkText: string;
	badge: string;
};

export const ACTIVITY_CONFIG: Record<string, ActivityMeta> = {
	SWIM: {
		icon: Waves,
		color: "#06b6d4",
		cssColor: "var(--color-swim)",
		lightBg: "#cffafe",
		darkBg: "#155e75",
		lightText: "#0e7490",
		darkText: "#a5f3fc",
		badge: "badge-swim",
	},
	BIKE: {
		icon: Bike,
		color: "#f59e0b",
		cssColor: "var(--color-bike)",
		lightBg: "#fef3c7",
		darkBg: "#78350f",
		lightText: "#b45309",
		darkText: "#fde68a",
		badge: "badge-bike",
	},
	RUN: {
		icon: Footprints,
		color: "#10b981",
		cssColor: "var(--color-run)",
		lightBg: "#d1fae5",
		darkBg: "#064e3b",
		lightText: "#047857",
		darkText: "#6ee7b7",
		badge: "badge-run",
	},
	STRENGTH: {
		icon: Dumbbell,
		color: "#8b5cf6",
		cssColor: "var(--color-strength)",
		lightBg: "#ede9fe",
		darkBg: "#4c1d95",
		lightText: "#6d28d9",
		darkText: "#c4b5fd",
		badge: "badge-strength",
	},
	YOGA: {
		icon: Activity,
		color: "#ec4899",
		cssColor: "var(--color-yoga)",
		lightBg: "#fce7f3",
		darkBg: "#831843",
		lightText: "#be185d",
		darkText: "#f9a8d4",
		badge: "badge-yoga",
	},
	OTHER: {
		icon: Zap,
		color: "#6b7280",
		cssColor: "var(--color-other)",
		lightBg: "#f3f4f6",
		darkBg: "#374151",
		lightText: "#4b5563",
		darkText: "#d1d5db",
		badge: "badge-other",
	},
};

export function getActivityConfig(type: string): ActivityMeta {
	return ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.OTHER;
}
