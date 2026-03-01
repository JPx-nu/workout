"use client";

/**
 * Training Calendar — Schedule-X powered week/month view
 * with colour-coded workout events loaded from the planned_workouts API.
 *
 * Drag-and-drop uses @dnd-kit for free-tier compatibility.
 */

import { createViewDay, createViewMonthGrid, createViewWeek } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import { ScheduleXCalendar, useNextCalendarApp } from "@schedule-x/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "temporal-polyfill/global";
import "@schedule-x/theme-shadcn/dist/index.css";
import {
	Activity,
	Bike,
	Calendar,
	CalendarDays,
	CalendarRange,
	ChevronLeft,
	ChevronRight,
	Clock,
	Dumbbell,
	Flame,
	Footprints,
	MapPin,
	Trash2,
	Waves,
	X,
	Zap,
} from "lucide-react";
import { type PlannedWorkout, usePlannedWorkouts } from "@/hooks/use-planned-workouts";

// ── Activity meta ──────────────────────────────────────────────

const ACTIVITY_CONFIG: Record<
	string,
	{
		icon: typeof Waves;
		color: string;
		lightBg: string;
		darkBg: string;
		lightText: string;
		darkText: string;
	}
> = {
	SWIM: {
		icon: Waves,
		color: "#06b6d4",
		lightBg: "#cffafe",
		darkBg: "#155e75",
		lightText: "#0e7490",
		darkText: "#a5f3fc",
	},
	BIKE: {
		icon: Bike,
		color: "#f59e0b",
		lightBg: "#fef3c7",
		darkBg: "#78350f",
		lightText: "#b45309",
		darkText: "#fde68a",
	},
	RUN: {
		icon: Footprints,
		color: "#10b981",
		lightBg: "#d1fae5",
		darkBg: "#064e3b",
		lightText: "#047857",
		darkText: "#6ee7b7",
	},
	STRENGTH: {
		icon: Dumbbell,
		color: "#8b5cf6",
		lightBg: "#ede9fe",
		darkBg: "#4c1d95",
		lightText: "#6d28d9",
		darkText: "#c4b5fd",
	},
	YOGA: {
		icon: Activity,
		color: "#ec4899",
		lightBg: "#fce7f3",
		darkBg: "#831843",
		lightText: "#be185d",
		darkText: "#f9a8d4",
	},
	OTHER: {
		icon: Zap,
		color: "#6b7280",
		lightBg: "#f3f4f6",
		darkBg: "#374151",
		lightText: "#4b5563",
		darkText: "#d1d5db",
	},
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
	planned: { label: "Planned", color: "var(--color-text-muted)" },
	completed: { label: "Done", color: "var(--color-success)" },
	skipped: { label: "Skipped", color: "var(--color-warning)" },
	in_progress: { label: "In Progress", color: "var(--color-brand)" },
	modified: { label: "Modified", color: "var(--color-info, #3b82f6)" },
};

// ── Helpers ────────────────────────────────────────────────────

function getDateRange(baseDate: Date, view: string) {
	const d = new Date(baseDate);
	if (view === "month-grid") {
		const start = new Date(d.getFullYear(), d.getMonth(), 1);
		const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
		// Pad to full weeks
		start.setDate(start.getDate() - start.getDay() + 1);
		end.setDate(end.getDate() + (7 - end.getDay()));
		return { from: fmt(start), to: fmt(end) };
	}
	// Week view — Monday to Sunday
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	const start = new Date(d.setDate(diff));
	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	return { from: fmt(start), to: fmt(end) };
}

function fmt(d: Date): string {
	return d.toISOString().split("T")[0];
}

function toCalendarEvents(workouts: PlannedWorkout[]) {
	return workouts.map((w) => {
		const startTime = w.plannedTime || "08:00";
		const durationMin = w.durationMin || 60;

		// Build Temporal.ZonedDateTime for start + end (Schedule-X requires PlainDate | ZonedDateTime)
		const tz = Temporal.Now.timeZoneId();
		const startDt = Temporal.ZonedDateTime.from(`${w.plannedDate}T${startTime}[${tz}]`);
		const endDt = startDt.add({ minutes: durationMin });

		return {
			id: w.id,
			title: w.title,
			start: startDt,
			end: endDt,
			calendarId: w.activityType.toLowerCase(),
			_custom: {
				activityType: w.activityType,
				status: w.status,
				intensity: w.intensity,
				durationMin: w.durationMin,
			},
		};
	});
}

// ── Main component ─────────────────────────────────────────────

export default function TrainingCalendarPage() {
	const [selectedDate, setSelectedDate] = useState(() => new Date());
	const [activeView, setActiveView] = useState<"day" | "week" | "month-grid">("week");
	const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);

	const { from, to } = useMemo(
		() => getDateRange(selectedDate, activeView),
		[selectedDate, activeView],
	);

	const { workouts, isLoading, refetch, updateWorkout, deleteWorkout } = usePlannedWorkouts(
		from,
		to,
	);

	const eventsService = useMemo(() => createEventsServicePlugin(), []);

	// Build Schedule-X calendar categories from activity types
	const calendars = useMemo(() => {
		const cal: Record<
			string,
			{
				colorName: string;
				lightColors: { main: string; container: string; onContainer: string };
				darkColors: { main: string; container: string; onContainer: string };
			}
		> = {};
		for (const [key, cfg] of Object.entries(ACTIVITY_CONFIG)) {
			cal[key.toLowerCase()] = {
				colorName: key.toLowerCase(),
				lightColors: {
					main: cfg.color,
					container: cfg.lightBg,
					onContainer: cfg.lightText,
				},
				darkColors: {
					main: cfg.color,
					container: cfg.darkBg,
					onContainer: cfg.darkText,
				},
			};
		}
		return cal;
	}, []);

	const calendar = useNextCalendarApp({
		views: [createViewDay(), createViewWeek(), createViewMonthGrid()],
		defaultView: "week",
		locale: "en-US",
		firstDayOfWeek: 1,
		selectedDate: Temporal.PlainDate.from(fmt(selectedDate)),
		dayBoundaries: { start: "05:00", end: "22:00" },
		weekOptions: { gridHeight: 1800, nDays: 7, eventWidth: 95, gridStep: 15 },
		calendars,
		events: [],
		callbacks: {
			onEventClick: (event) => {
				const workout = workouts.find((w) => w.id === event.id);
				if (workout) setSelectedWorkout(workout);
			},
			onEventUpdate: async (event) => {
				// Drag/resize → update date/time
				const startStr = String(event.start);
				const [date, time] = startStr.includes(" ") ? startStr.split(" ") : [startStr, undefined];
				await updateWorkout(event.id as string, {
					plannedDate: date,
					...(time ? { plannedTime: time } : {}),
				});
			},
			onRangeUpdate: () => {
				refetch();
			},
		},
		plugins: [eventsService],
	});

	// Sync workouts → Schedule-X events
	useEffect(() => {
		if (!workouts.length) {
			eventsService.set([]);
			return;
		}
		const events = toCalendarEvents(workouts);
		eventsService.set(events);
	}, [workouts, eventsService]);

	// Navigation
	const navigate = useCallback(
		(dir: -1 | 1) => {
			setSelectedDate((prev) => {
				const d = new Date(prev);
				if (activeView === "month-grid") d.setMonth(d.getMonth() + dir);
				else if (activeView === "week") d.setDate(d.getDate() + 7 * dir);
				else d.setDate(d.getDate() + dir);
				return d;
			});
		},
		[activeView],
	);

	const goToToday = useCallback(() => setSelectedDate(new Date()), []);

	const dateLabel = useMemo(() => {
		const opts: Intl.DateTimeFormatOptions =
			activeView === "month-grid"
				? { month: "long", year: "numeric" }
				: { month: "short", day: "numeric", year: "numeric" };
		return selectedDate.toLocaleDateString("en-US", opts);
	}, [selectedDate, activeView]);

	// ── Modal helpers ──────────────────────────────────────────

	const handleDelete = async () => {
		if (!selectedWorkout) return;
		await deleteWorkout(selectedWorkout.id);
		setSelectedWorkout(null);
	};

	const handleStatusChange = async (status: string) => {
		if (!selectedWorkout) return;
		await updateWorkout(selectedWorkout.id, { status });
		setSelectedWorkout((prev) => (prev ? { ...prev, status } : null));
	};

	// ── Render ─────────────────────────────────────────────────

	return (
		<div className="space-y-4 animate-fade-in">
			{/* ── Header bar ──────────────────────────────── */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">Training Calendar</h1>
					<p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
						Plan and track your workouts
					</p>
				</div>

				<div className="flex items-center gap-2">
					<button onClick={goToToday} className="btn-glass text-xs px-3 py-1.5">
						Today
					</button>
					<div className="flex items-center glass-card rounded-xl overflow-hidden">
						<button onClick={() => navigate(-1)} className="p-2 hover-surface transition-colors">
							<ChevronLeft size={16} />
						</button>
						<span className="px-3 text-sm font-medium min-w-[140px] text-center">{dateLabel}</span>
						<button onClick={() => navigate(1)} className="p-2 hover-surface transition-colors">
							<ChevronRight size={16} />
						</button>
					</div>

					{/* View switcher */}
					<div className="flex glass-card rounded-xl overflow-hidden">
						{[
							{ key: "day" as const, icon: CalendarDays, label: "Day" },
							{ key: "week" as const, icon: CalendarRange, label: "Week" },
							{ key: "month-grid" as const, icon: Calendar, label: "Month" },
						].map(({ key, icon: Icon, label }) => (
							<button
								key={key}
								onClick={() => setActiveView(key)}
								className={`p-2 px-3 text-xs flex items-center gap-1.5 transition-colors
                                    ${activeView === key ? "text-white" : "hover-surface"}`}
								style={activeView === key ? { background: "var(--color-brand)" } : undefined}
							>
								<Icon size={14} />
								<span className="hidden sm:inline">{label}</span>
							</button>
						))}
					</div>
				</div>
			</div>

			{/* ── Activity legend ─────────────────────────── */}
			<div className="flex flex-wrap gap-3">
				{Object.entries(ACTIVITY_CONFIG).map(([key, cfg]) => {
					const Icon = cfg.icon;
					return (
						<div
							key={key}
							className="flex items-center gap-1.5 text-xs"
							style={{ color: "var(--color-text-secondary)" }}
						>
							<span
								className="w-2.5 h-2.5 rounded-full inline-block"
								style={{ background: cfg.color }}
							/>
							<Icon size={12} />
							<span className="capitalize">{key.toLowerCase()}</span>
						</div>
					);
				})}
			</div>

			{/* ── Calendar ────────────────────────────────── */}
			<div className="glass-card rounded-2xl overflow-hidden" style={{ minHeight: 600 }}>
				{isLoading && (
					<div className="flex items-center justify-center py-8">
						<div
							className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent"
							style={{ color: "var(--color-brand)" }}
						/>
					</div>
				)}
				<ScheduleXCalendar calendarApp={calendar} />
			</div>

			{/* ── Workout Detail Modal ────────────────────── */}
			{selectedWorkout && (
				<WorkoutDetailModal
					workout={selectedWorkout}
					onClose={() => setSelectedWorkout(null)}
					onDelete={handleDelete}
					onStatusChange={handleStatusChange}
				/>
			)}
		</div>
	);
}

// ── Workout detail modal ───────────────────────────────────────

function WorkoutDetailModal({
	workout,
	onClose,
	onDelete,
	onStatusChange,
}: {
	workout: PlannedWorkout;
	onClose: () => void;
	onDelete: () => void;
	onStatusChange: (status: string) => void;
}) {
	const cfg = ACTIVITY_CONFIG[workout.activityType] || ACTIVITY_CONFIG.OTHER;
	const Icon = cfg.icon;
	const statusInfo = STATUS_LABELS[workout.status] || STATUS_LABELS.planned;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
		>
			<div
				className="glass-card rounded-2xl w-full max-w-md p-6 animate-scale-in"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-start justify-between mb-4">
					<div className="flex items-center gap-3">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center"
							style={{
								background: `color-mix(in oklch, ${cfg.color}, transparent 80%)`,
							}}
						>
							<Icon size={20} style={{ color: cfg.color }} />
						</div>
						<div>
							<h2 className="text-lg font-bold">{workout.title}</h2>
							<p className="text-xs capitalize" style={{ color: "var(--color-text-muted)" }}>
								{workout.activityType.toLowerCase()}
								{workout.intensity && ` · ${workout.intensity.toLowerCase()}`}
							</p>
						</div>
					</div>
					<button onClick={onClose} className="p-1.5 rounded-lg hover-surface transition-colors">
						<X size={18} />
					</button>
				</div>

				{/* Details */}
				<div className="space-y-3 mb-5">
					<div
						className="flex items-center gap-2 text-sm"
						style={{ color: "var(--color-text-secondary)" }}
					>
						<CalendarDays size={14} />
						<span>
							{new Date(workout.plannedDate).toLocaleDateString("en-US", {
								weekday: "long",
								month: "long",
								day: "numeric",
							})}
							{workout.plannedTime && ` at ${workout.plannedTime}`}
						</span>
					</div>

					{workout.durationMin && (
						<div
							className="flex items-center gap-2 text-sm"
							style={{ color: "var(--color-text-secondary)" }}
						>
							<Clock size={14} />
							<span>{workout.durationMin} minutes</span>
						</div>
					)}

					{workout.distanceKm && (
						<div
							className="flex items-center gap-2 text-sm"
							style={{ color: "var(--color-text-secondary)" }}
						>
							<MapPin size={14} />
							<span>{workout.distanceKm} km</span>
						</div>
					)}

					{workout.targetRpe && (
						<div
							className="flex items-center gap-2 text-sm"
							style={{ color: "var(--color-text-secondary)" }}
						>
							<Flame size={14} />
							<span>Target RPE: {workout.targetRpe}/10</span>
						</div>
					)}

					{workout.description && (
						<div
							className="mt-3 p-3 rounded-xl text-sm"
							style={{
								background: "var(--color-glass-bg-subtle)",
								color: "var(--color-text-secondary)",
							}}
						>
							{workout.description}
						</div>
					)}

					{workout.coachNotes && (
						<div
							className="p-3 rounded-xl text-xs flex flex-col gap-2"
							style={{
								background: "var(--color-glass-bg-subtle)",
								color: "var(--color-text-secondary)",
							}}
						>
							<div>
								🤖 <span className="italic">{workout.coachNotes}</span>
							</div>
							{workout.source === "AI" && (
								<div
									className="text-[10px] mt-1 pt-2 border-t"
									style={{
										borderColor: "var(--color-glass-border)",
										color: "var(--color-text-muted)",
									}}
								>
									<strong>Human Oversight Required:</strong> This session was generated or adjusted
									by the JPx AI Coach based on your telemetry (e.g., HRV, recovery score). Please
									review and adjust if it does not match your perceived readiness.
								</div>
							)}
						</div>
					)}
					{!workout.coachNotes && workout.source === "AI" && (
						<div
							className="p-3 rounded-xl text-[10px]"
							style={{
								background: "var(--color-glass-bg-subtle)",
								color: "var(--color-text-muted)",
							}}
						>
							<strong>Human Oversight Required:</strong> This session was generated or adjusted by
							the JPx AI Coach based on your telemetry. Please review and adjust if it does not
							match your perceived readiness.
						</div>
					)}
				</div>

				{/* Status badge */}
				<div className="flex items-center gap-2 mb-4">
					<span
						className="text-xs font-medium px-2.5 py-1 rounded-full"
						style={{
							color: statusInfo.color,
							background: `color-mix(in oklch, ${statusInfo.color}, transparent 85%)`,
						}}
					>
						{statusInfo.label}
					</span>
					{workout.source === "AI" && (
						<span
							className="text-xs font-medium px-2.5 py-1 rounded-full"
							style={{
								color: "var(--color-brand)",
								background: "var(--color-glass-bg-subtle)",
							}}
						>
							AI Generated
						</span>
					)}
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					{workout.status === "planned" && (
						<button
							onClick={() => onStatusChange("completed")}
							className="flex-1 btn-glass text-sm py-2 flex items-center justify-center gap-1.5"
							style={{ color: "var(--color-success)" }}
						>
							✓ Mark Done
						</button>
					)}
					{workout.status === "planned" && (
						<button
							onClick={() => onStatusChange("skipped")}
							className="btn-glass text-sm py-2 px-3"
							style={{ color: "var(--color-warning)" }}
						>
							Skip
						</button>
					)}
					<button
						onClick={onDelete}
						className="btn-glass text-sm py-2 px-3"
						style={{ color: "var(--color-error, #ef4444)" }}
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>
		</div>
	);
}
