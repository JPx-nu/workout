"use client";

import { findStrengthExerciseCatalogItem, type MappedPlannedWorkout } from "@triathlon/core";
import type { ActivityType, StrengthExerciseCatalogItem } from "@triathlon/types";
import { Clock3, Dumbbell, History, ListChecks, Plus, Sparkles, TimerReset } from "lucide-react";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { ExercisePicker } from "@/components/workout-center/exercise-picker";
import {
	buildCompletedWorkoutPayload,
	buildPlannedWorkoutPayload,
	buildPreviousStrengthMap,
	createEmptyWorkoutForm,
	createExerciseFromCatalog,
	hydrateFormFromPlannedWorkout,
	hydrateFormFromWorkout,
	isFormMeaningful,
	toDateInputValue,
	type WorkoutCenterFormState,
	type WorkoutCenterMode,
} from "@/components/workout-center/model";
import { StrengthEditor } from "@/components/workout-center/strength-editor";
import { usePlannedWorkouts } from "@/hooks/use-planned-workouts";
import { useWorkoutCenter } from "@/hooks/use-workout-center";
import { useWorkouts } from "@/hooks/use-workouts";
import { getActivityConfig } from "@/lib/activity-config";
import type { WorkoutCenterBootstrap } from "@/lib/dashboard/types";

const MODE_OPTIONS = [
	{ id: "start_now", label: "Start now", icon: TimerReset },
	{ id: "log_past", label: "Log past", icon: History },
	{ id: "schedule", label: "Schedule", icon: ListChecks },
] as const;

const ACTIVITY_OPTIONS = ["STRENGTH", "RUN", "BIKE", "SWIM", "YOGA", "OTHER"] as const;

type QueueItem = {
	id: string;
	payload: ReturnType<typeof buildPlannedWorkoutPayload>;
};

function getWideRange(): { from: string; to: string } {
	const now = new Date();
	const from = new Date(now);
	from.setDate(from.getDate() - 365);
	const to = new Date(now);
	to.setDate(to.getDate() + 365);
	return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function countCompletedSets(form: WorkoutCenterFormState): number {
	return form.exercises.reduce(
		(total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
		0,
	);
}

function totalSetCount(form: WorkoutCenterFormState): number {
	return form.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
}

export default function NewWorkoutPage({
	initialMode,
	initialActivity,
	requestedPlannedId,
	requestedWorkoutId,
	bootstrap,
}: {
	initialMode: WorkoutCenterMode;
	initialActivity: ActivityType;
	requestedPlannedId: string | null;
	requestedWorkoutId: string | null;
	bootstrap: WorkoutCenterBootstrap;
}) {
	const wideRange = useMemo(() => getWideRange(), []);

	const {
		allWorkouts,
		isLoading: workoutsLoading,
		refetch: refetchWorkouts,
	} = useWorkouts(bootstrap.allWorkouts);
	const {
		workouts: draftSessions,
		isLoading: draftsLoading,
		refetch: refetchDrafts,
	} = usePlannedWorkouts(wideRange.from, wideRange.to, "in_progress", bootstrap.draftSessions);
	const {
		workouts: plannedSessions,
		isLoading: plannedLoading,
		refetch: refetchPlanned,
	} = usePlannedWorkouts(wideRange.from, wideRange.to, undefined, bootstrap.plannedSessions);
	const {
		createCompletedWorkout,
		updateCompletedWorkout,
		createPlannedWorkout,
		updatePlannedWorkout,
		schedulePlannedWorkouts,
		isSaving,
		error,
		clearError,
	} = useWorkoutCenter();

	const [form, setForm] = useState(() => createEmptyWorkoutForm(initialMode, initialActivity));
	const [pickerOpen, setPickerOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [activePlannedId, setActivePlannedId] = useState<string | null>(requestedPlannedId);
	const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(requestedWorkoutId);
	const [queue, setQueue] = useState<QueueItem[]>([]);
	const [restTimerEndsAt, setRestTimerEndsAt] = useState<number | null>(null);
	const [restLabel, setRestLabel] = useState<string | null>(null);
	const [restRemainingSec, setRestRemainingSec] = useState(0);
	const [autosaveLabel, setAutosaveLabel] = useState<string | null>(null);

	const seededRef = useRef(false);
	const autosaveSnapshotRef = useRef("");

	const previousStrengthLookup = useMemo(
		() => buildPreviousStrengthMap(allWorkouts),
		[allWorkouts],
	);
	const recentExercises = useMemo(() => {
		const seen = new Set<string>();
		const recent: StrengthExerciseCatalogItem[] = [];

		for (const workout of allWorkouts) {
			if (workout.activityType !== "STRENGTH") {
				continue;
			}

			const strengthSession =
				typeof workout.rawData === "object" && workout.rawData !== null ? workout.rawData : null;
			if (
				!strengthSession ||
				!("exercises" in strengthSession) ||
				!Array.isArray(strengthSession.exercises)
			) {
				continue;
			}

			for (const rawExercise of strengthSession.exercises) {
				if (typeof rawExercise !== "object" || rawExercise === null) {
					continue;
				}

				const displayName =
					typeof rawExercise.displayName === "string"
						? rawExercise.displayName
						: typeof rawExercise.name === "string"
							? rawExercise.name
							: null;
				if (!displayName) {
					continue;
				}

				const catalogItem = findStrengthExerciseCatalogItem(displayName);
				if (!catalogItem || seen.has(catalogItem.id)) {
					continue;
				}

				seen.add(catalogItem.id);
				recent.push(catalogItem);
				if (recent.length >= 8) {
					return recent;
				}
			}
		}

		return recent;
	}, [allWorkouts]);

	const currentDrafts = useMemo(
		() => draftSessions.filter((session) => session.id !== activePlannedId),
		[draftSessions, activePlannedId],
	);

	const selectedPlannedWorkout = useMemo(
		() => plannedSessions.find((session) => session.id === requestedPlannedId) ?? null,
		[plannedSessions, requestedPlannedId],
	);
	const selectedWorkout = useMemo(
		() => allWorkouts.find((workout) => workout.id === requestedWorkoutId) ?? null,
		[allWorkouts, requestedWorkoutId],
	);

	useEffect(() => {
		if (seededRef.current) {
			return;
		}

		if (requestedWorkoutId && !selectedWorkout) {
			return;
		}

		if (requestedPlannedId && !selectedPlannedWorkout) {
			return;
		}

		seededRef.current = true;
		if (selectedWorkout) {
			setForm(hydrateFormFromWorkout(selectedWorkout));
			setActiveWorkoutId(selectedWorkout.id);
			setActivePlannedId(null);
			return;
		}

		if (selectedPlannedWorkout) {
			setForm(hydrateFormFromPlannedWorkout(selectedPlannedWorkout));
			setActivePlannedId(selectedPlannedWorkout.id);
			setActiveWorkoutId(selectedPlannedWorkout.workoutId);
			autosaveSnapshotRef.current = JSON.stringify(
				buildPlannedWorkoutPayload(
					hydrateFormFromPlannedWorkout(selectedPlannedWorkout),
					"in_progress",
				),
			);
			return;
		}

		setForm(createEmptyWorkoutForm(initialMode, initialActivity));
	}, [
		initialActivity,
		initialMode,
		requestedPlannedId,
		requestedWorkoutId,
		selectedPlannedWorkout,
		selectedWorkout,
	]);

	useEffect(() => {
		if (!restTimerEndsAt) {
			setRestRemainingSec(0);
			return;
		}

		const tick = () => {
			const remaining = Math.max(0, Math.ceil((restTimerEndsAt - Date.now()) / 1000));
			setRestRemainingSec(remaining);
			if (remaining === 0) {
				setRestTimerEndsAt(null);
				setRestLabel(null);
			}
		};

		tick();
		const interval = window.setInterval(tick, 1000);
		return () => window.clearInterval(interval);
	}, [restTimerEndsAt]);

	useEffect(() => {
		if (form.mode !== "start_now" || !activePlannedId || !seededRef.current) {
			return;
		}

		const payload = buildPlannedWorkoutPayload(form, "in_progress");
		const snapshot = JSON.stringify(payload);
		if (snapshot === autosaveSnapshotRef.current) {
			return;
		}

		const timeout = window.setTimeout(async () => {
			try {
				await updatePlannedWorkout(activePlannedId, payload);
				autosaveSnapshotRef.current = snapshot;
				setAutosaveLabel(
					`Autosaved ${new Date().toLocaleTimeString("en-US", {
						hour: "numeric",
						minute: "2-digit",
					})}`,
				);
			} catch {
				// Hook error state already captures request failures.
			}
		}, 1400);

		return () => window.clearTimeout(timeout);
	}, [activePlannedId, form, updatePlannedWorkout]);

	async function refreshData() {
		await Promise.all([refetchDrafts(), refetchPlanned(), refetchWorkouts()]);
	}

	function updateForm(patch: Partial<WorkoutCenterFormState>) {
		setForm((current) => ({ ...current, ...patch }));
	}

	function changeMode(nextMode: WorkoutCenterMode) {
		clearError();
		setMessage(null);
		setAutosaveLabel(null);
		setQueue([]);
		setActiveWorkoutId(null);
		setActivePlannedId(null);
		setForm((current) => ({ ...current, mode: nextMode }));
	}

	function changeActivity(nextActivity: ActivityType) {
		clearError();
		setMessage(null);
		setForm((current) => ({
			...current,
			activityType: nextActivity,
			exercises: nextActivity === "STRENGTH" ? current.exercises : [],
		}));
	}

	function loadPlannedWorkout(workout: MappedPlannedWorkout) {
		startTransition(() => {
			const nextForm = hydrateFormFromPlannedWorkout(workout);
			setForm(nextForm);
			setActivePlannedId(workout.id);
			setActiveWorkoutId(workout.workoutId);
			autosaveSnapshotRef.current = JSON.stringify(
				buildPlannedWorkoutPayload(
					nextForm,
					nextForm.mode === "start_now" ? "in_progress" : "planned",
				),
			);
			setMessage(`Loaded ${workout.title}.`);
		});
	}

	async function handleSaveDraft() {
		clearError();
		setMessage(null);

		if (form.mode !== "start_now") {
			return;
		}

		const payload = buildPlannedWorkoutPayload(form, "in_progress");
		if (activePlannedId) {
			await updatePlannedWorkout(activePlannedId, payload);
			setMessage("Draft updated.");
		} else {
			const created = await createPlannedWorkout(payload);
			setActivePlannedId(created.id);
			setMessage("Workout started. Edits will autosave.");
		}

		autosaveSnapshotRef.current = JSON.stringify(payload);
		await refetchDrafts();
	}

	async function handlePrimaryAction() {
		clearError();
		setMessage(null);

		const hasCurrentSession = isFormMeaningful(form);
		if (form.mode === "schedule" && queue.length > 0 && !hasCurrentSession) {
			await schedulePlannedWorkouts({
				workouts: queue.map((item) => item.payload),
			});
			setQueue([]);
			setMessage("Scheduled your queued sessions.");
			await refetchPlanned();
			return;
		}

		if (!hasCurrentSession) {
			setMessage("Add the core workout details first so the session can be saved cleanly.");
			return;
		}

		if (form.mode === "start_now" && !activePlannedId) {
			await handleSaveDraft();
			return;
		}

		if (form.mode === "start_now") {
			const workout = await createCompletedWorkout(
				buildCompletedWorkoutPayload(form, { plannedWorkoutId: activePlannedId ?? undefined }),
			);
			setActiveWorkoutId(workout.id);
			setActivePlannedId(null);
			setAutosaveLabel(null);
			setMessage("Workout finished and added to history.");
			await refreshData();
			return;
		}

		if (form.mode === "log_past") {
			if (activeWorkoutId) {
				await updateCompletedWorkout(activeWorkoutId, buildCompletedWorkoutPayload(form));
				setMessage("Workout updated.");
			} else {
				const created = await createCompletedWorkout(buildCompletedWorkoutPayload(form));
				setActiveWorkoutId(created.id);
				setMessage("Workout saved to history.");
			}
			await refreshData();
			return;
		}

		const currentPayload = buildPlannedWorkoutPayload(form, "planned");
		if (activePlannedId) {
			await updatePlannedWorkout(activePlannedId, currentPayload);
			setMessage("Planned session updated.");
			await refetchPlanned();
			return;
		}

		if (queue.length > 0) {
			await schedulePlannedWorkouts({
				workouts: [...queue.map((item) => item.payload), currentPayload],
			});
			setQueue([]);
			setMessage("Scheduled your queued sessions.");
		} else {
			await createPlannedWorkout(currentPayload);
			setMessage("Session added to the training calendar.");
		}

		setForm(createEmptyWorkoutForm("schedule", form.activityType));
		await refetchPlanned();
	}

	function handleQueueCurrentSession() {
		if (!isFormMeaningful(form)) {
			setMessage("Build the current session before adding it to the batch.");
			return;
		}

		const payload = buildPlannedWorkoutPayload(form, "planned");
		setQueue((current) => [...current, { id: crypto.randomUUID(), payload }]);
		setForm(createEmptyWorkoutForm("schedule", form.activityType));
		setActivePlannedId(null);
		setMessage(`Queued ${payload.title}.`);
	}

	const primaryLabel =
		form.mode === "start_now"
			? activePlannedId
				? "Finish workout"
				: "Start workout"
			: form.mode === "log_past"
				? activeWorkoutId
					? "Update workout"
					: "Save workout"
				: activePlannedId
					? "Update session"
					: "Schedule sessions";

	return (
		<div className="space-y-6 animate-fade-in" data-testid="workout-center-page">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold">Workout Center</h1>
					<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
						Start live sessions, quick-log something already done, or batch future work into the
						training calendar. AI and manual entry now share the same session structure.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Link href="/dashboard/coach" className="btn-ghost text-sm">
						Open AI Coach
					</Link>
					<Link href="/dashboard/training" className="btn-ghost text-sm">
						View calendar
					</Link>
				</div>
			</div>

			{message && (
				<div
					data-testid="workout-center-message"
					className="rounded-xl px-4 py-3 text-sm"
					style={{ background: "var(--color-glass-bg-subtle)" }}
				>
					{message}
				</div>
			)}
			{error && (
				<div
					className="rounded-xl px-4 py-3 text-sm"
					style={{ background: "color-mix(in oklch, var(--color-danger), transparent 85%)" }}
				>
					{error}
				</div>
			)}

			<div className="flex flex-wrap gap-2">
				{MODE_OPTIONS.map((option) => {
					const active = form.mode === option.id;
					return (
						<button
							key={option.id}
							type="button"
							onClick={() => changeMode(option.id)}
							data-testid={`mode-${option.id}`}
							className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
							style={
								active
									? {
											background: "color-mix(in oklch, var(--color-brand), transparent 78%)",
											color: "var(--color-brand-light)",
										}
									: {
											background: "var(--color-glass-bg-subtle)",
											color: "var(--color-text-secondary)",
										}
							}
						>
							<option.icon size={14} className="inline-block mr-1.5" />
							{option.label}
						</button>
					);
				})}
			</div>

			<div className="flex flex-wrap gap-2">
				{ACTIVITY_OPTIONS.map((activity) => {
					const config = getActivityConfig(activity);
					const Icon = config.icon;
					const active = form.activityType === activity;
					return (
						<button
							key={activity}
							type="button"
							onClick={() => changeActivity(activity)}
							data-testid={`activity-${activity.toLowerCase()}`}
							className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
							style={
								active
									? {
											background: `color-mix(in oklch, ${config.cssColor}, transparent 80%)`,
											color: config.cssColor,
										}
									: {
											background: "var(--color-glass-bg-subtle)",
											color: "var(--color-text-secondary)",
										}
							}
						>
							<Icon size={14} className="inline-block mr-1.5" />
							{activity.charAt(0) + activity.slice(1).toLowerCase()}
						</button>
					);
				})}
			</div>

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
				<div className="space-y-6">
					<section className="glass-card p-4 lg:p-6">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label
									htmlFor="workout-center-title"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Session title / focus
								</label>
								<input
									id="workout-center-title"
									type="text"
									data-testid="workout-title-input"
									value={form.title}
									onChange={(event) =>
										updateForm({ title: event.target.value, focus: event.target.value })
									}
									className="glass-input w-full"
									placeholder={
										form.activityType === "STRENGTH" ? "Upper pull + hinge" : "Easy zone 2 run"
									}
								/>
							</div>
							<div>
								<label
									htmlFor="workout-center-date"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									{form.mode === "log_past"
										? "Completed on"
										: form.mode === "schedule"
											? "Planned date"
											: "Started on"}
								</label>
								<div className="grid grid-cols-2 gap-3">
									<input
										id="workout-center-date"
										type="date"
										data-testid="workout-date-input"
										value={form.date}
										onChange={(event) => updateForm({ date: event.target.value })}
										className="glass-input w-full"
									/>
									<input
										id="workout-center-time"
										type="time"
										data-testid="workout-time-input"
										value={form.time}
										onChange={(event) => updateForm({ time: event.target.value })}
										className="glass-input w-full"
									/>
								</div>
							</div>
							<div>
								<label
									htmlFor="workout-center-duration"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Duration (min)
								</label>
								<input
									id="workout-center-duration"
									type="number"
									min="0"
									step="1"
									data-testid="workout-duration-input"
									value={form.durationMin}
									onChange={(event) => updateForm({ durationMin: event.target.value })}
									className="glass-input w-full"
								/>
							</div>
							<div>
								<label
									htmlFor="workout-center-distance"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Distance (km)
								</label>
								<input
									id="workout-center-distance"
									type="number"
									min="0"
									step="0.1"
									data-testid="workout-distance-input"
									value={form.distanceKm}
									onChange={(event) => updateForm({ distanceKm: event.target.value })}
									className="glass-input w-full"
								/>
							</div>
							<div>
								<label
									htmlFor="workout-center-intensity"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Intensity
								</label>
								<select
									id="workout-center-intensity"
									value={form.intensity}
									onChange={(event) =>
										updateForm({
											intensity: event.target.value as WorkoutCenterFormState["intensity"],
										})
									}
									className="glass-input w-full"
								>
									<option value="">Select intensity</option>
									<option value="RECOVERY">Recovery</option>
									<option value="EASY">Easy</option>
									<option value="MODERATE">Moderate</option>
									<option value="HARD">Hard</option>
									<option value="MAX">Max</option>
								</select>
							</div>
							<div>
								<label
									htmlFor="workout-center-rpe"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Target / avg RPE
								</label>
								<input
									id="workout-center-rpe"
									type="number"
									min="1"
									max="10"
									step="0.5"
									data-testid="workout-target-rpe-input"
									value={form.targetRpe}
									onChange={(event) => updateForm({ targetRpe: event.target.value })}
									className="glass-input w-full"
								/>
							</div>
							{form.mode !== "schedule" && (
								<>
									<div>
										<label
											htmlFor="workout-center-hr"
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											Average HR
										</label>
										<input
											id="workout-center-hr"
											type="number"
											min="30"
											step="1"
											data-testid="workout-avg-hr-input"
											value={form.avgHr}
											onChange={(event) => updateForm({ avgHr: event.target.value })}
											className="glass-input w-full"
										/>
									</div>
									<div>
										<label
											htmlFor="workout-center-tss"
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											TSS
										</label>
										<input
											id="workout-center-tss"
											type="number"
											min="0"
											step="1"
											data-testid="workout-tss-input"
											value={form.tss}
											onChange={(event) => updateForm({ tss: event.target.value })}
											className="glass-input w-full"
										/>
									</div>
								</>
							)}
						</div>

						<div className="mt-4">
							<label
								htmlFor="workout-center-notes"
								className="mb-1.5 block text-xs font-medium"
								style={{ color: "var(--color-text-muted)" }}
							>
								Session notes
							</label>
							<textarea
								id="workout-center-notes"
								data-testid="workout-notes-input"
								value={form.notes}
								onChange={(event) => updateForm({ notes: event.target.value })}
								className="glass-input min-h-28 w-full"
								placeholder="Standard maintenance, felt fresh, swapped in machine chest press, etc."
							/>
						</div>
					</section>

					{form.activityType === "STRENGTH" ? (
						<StrengthEditor
							mode={form.mode}
							exercises={form.exercises}
							previousLookup={previousStrengthLookup}
							onChange={(exercises) => updateForm({ exercises })}
							onOpenPicker={() => setPickerOpen(true)}
							onStartRest={(seconds, exerciseName) => {
								setRestLabel(exerciseName);
								setRestTimerEndsAt(Date.now() + seconds * 1000);
							}}
						/>
					) : (
						<section className="glass-card p-4 lg:p-6">
							<h2 className="text-lg font-semibold">Generic workout details</h2>
							<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Strength has the full structured builder first. Other activity types use a fast
								generic entry here and still save through the same Workout Center routes.
							</p>
							<div className="mt-4">
								<label
									htmlFor="workout-center-description"
									className="mb-1.5 block text-xs font-medium"
									style={{ color: "var(--color-text-muted)" }}
								>
									Instructions / context
								</label>
								<textarea
									id="workout-center-description"
									value={form.description}
									onChange={(event) => updateForm({ description: event.target.value })}
									className="glass-input min-h-32 w-full"
									placeholder="Terrain, intervals, warm-up, what was planned, what actually happened."
								/>
							</div>
						</section>
					)}
				</div>

				<div className="space-y-4">
					<section className="glass-card p-4 lg:p-5">
						<div className="flex items-center gap-2 text-sm font-semibold">
							<Sparkles size={16} />
							Session status
						</div>
						<div className="mt-3 grid grid-cols-2 gap-3 text-sm">
							<div>
								<div style={{ color: "var(--color-text-muted)" }}>Exercises</div>
								<div className="mt-1 text-lg font-semibold">{form.exercises.length}</div>
							</div>
							<div>
								<div style={{ color: "var(--color-text-muted)" }}>Sets</div>
								<div className="mt-1 text-lg font-semibold">{totalSetCount(form)}</div>
							</div>
							<div>
								<div style={{ color: "var(--color-text-muted)" }}>Completed</div>
								<div className="mt-1 text-lg font-semibold">{countCompletedSets(form)}</div>
							</div>
							<div>
								<div style={{ color: "var(--color-text-muted)" }}>Autosave</div>
								<div className="mt-1 text-sm font-medium">{autosaveLabel ?? "Idle"}</div>
							</div>
						</div>
						{restRemainingSec > 0 && (
							<div
								className="mt-4 rounded-xl px-4 py-3"
								style={{ background: "color-mix(in oklch, var(--color-brand), transparent 82%)" }}
							>
								<div
									className="text-xs uppercase tracking-wide"
									style={{ color: "var(--color-brand-light)" }}
								>
									Rest timer
								</div>
								<div className="mt-1 text-2xl font-bold">{restRemainingSec}s</div>
								<div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
									{restLabel || "Current exercise"}
								</div>
							</div>
						)}
					</section>

					{form.mode === "start_now" && (
						<section className="glass-card p-4 lg:p-5">
							<div className="flex items-center gap-2 text-sm font-semibold">
								<Clock3 size={16} />
								In-progress drafts
							</div>
							<div className="mt-3 space-y-2">
								{draftsLoading ? (
									<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
										Loading drafts...
									</div>
								) : currentDrafts.length === 0 ? (
									<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
										No other draft workouts right now.
									</div>
								) : (
									currentDrafts.slice(0, 4).map((draft) => (
										<button
											key={draft.id}
											type="button"
											onClick={() => loadPlannedWorkout(draft)}
											className="w-full rounded-xl border px-3 py-3 text-left hover-surface"
											style={{ borderColor: "var(--color-glass-border)" }}
										>
											<div className="text-sm font-medium">{draft.title}</div>
											<div
												className="mt-1 text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{draft.plannedDate}
												{draft.plannedTime ? ` at ${draft.plannedTime}` : ""}
											</div>
										</button>
									))
								)}
							</div>
						</section>
					)}

					{form.mode === "schedule" && !activePlannedId && (
						<section className="glass-card p-4 lg:p-5">
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2 text-sm font-semibold">
									<Plus size={16} />
									Schedule batch
								</div>
								<button
									type="button"
									onClick={handleQueueCurrentSession}
									className="rounded-lg border px-3 py-2 text-xs font-semibold hover-surface"
									style={{ borderColor: "var(--color-glass-border)" }}
								>
									Add current
								</button>
							</div>
							<div className="mt-3 space-y-2">
								{queue.length === 0 ? (
									<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
										Queue more than one future session here, or just hit Schedule sessions to save
										the current editor directly.
									</div>
								) : (
									queue.map((item) => (
										<div
											key={item.id}
											className="rounded-xl border px-3 py-3"
											style={{ borderColor: "var(--color-glass-border)" }}
										>
											<div className="text-sm font-medium">{item.payload.title}</div>
											<div
												className="mt-1 text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{item.payload.plannedDate}
												{item.payload.plannedTime ? ` at ${item.payload.plannedTime}` : ""}
												{item.payload.durationMin ? ` / ${item.payload.durationMin} min` : ""}
											</div>
										</div>
									))
								)}
							</div>
						</section>
					)}

					<section className="glass-card p-4 lg:p-5">
						<div className="flex items-center gap-2 text-sm font-semibold">
							<Dumbbell size={16} />
							Recent strength anchors
						</div>
						<div className="mt-3 space-y-2">
							{workoutsLoading || plannedLoading ? (
								<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
									Loading history...
								</div>
							) : recentExercises.length === 0 ? (
								<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
									Strength history will show up here after the first logged session.
								</div>
							) : (
								recentExercises.map((exercise) => (
									<div
										key={exercise.id}
										className="rounded-xl border px-3 py-3"
										style={{ borderColor: "var(--color-glass-border)" }}
									>
										<div className="text-sm font-medium">{exercise.displayName}</div>
										<div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
											{exercise.equipment.join(", ").replaceAll("_", " ")}
										</div>
									</div>
								))
							)}
						</div>
					</section>
				</div>
			</div>

			<div className="sticky bottom-4 z-20">
				<div className="glass-card flex flex-wrap items-center justify-between gap-3 p-3 lg:p-4">
					<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
						{form.mode === "start_now"
							? "Start now creates an in-progress draft first, then finishes into workout history."
							: form.mode === "log_past"
								? "Quick entry favors finishing the log first. Optional notes can come later."
								: "Schedule one session directly or batch multiple future sessions before saving."}
					</div>
					<div className="flex flex-wrap gap-2">
						{form.mode === "start_now" && (
							<button
								type="button"
								onClick={() => void handleSaveDraft()}
								disabled={isSaving}
								data-testid="save-draft-button"
								className="btn-ghost text-sm disabled:opacity-50"
							>
								Save draft
							</button>
						)}
						{form.mode === "schedule" && !activePlannedId && (
							<button
								type="button"
								onClick={handleQueueCurrentSession}
								disabled={isSaving}
								data-testid="queue-session-button"
								className="btn-ghost text-sm disabled:opacity-50"
							>
								Add to batch
							</button>
						)}
						<button
							type="button"
							onClick={() => void handlePrimaryAction()}
							disabled={isSaving}
							data-testid="primary-action-button"
							className="btn-primary text-sm disabled:opacity-50"
						>
							{isSaving ? "Saving..." : primaryLabel}
						</button>
					</div>
				</div>
			</div>

			<ExercisePicker
				open={pickerOpen}
				recent={recentExercises}
				onClose={() => setPickerOpen(false)}
				onPick={(item) => {
					const nextExercise = createExerciseFromCatalog(item);
					updateForm({ exercises: [...form.exercises, nextExercise] });
					setPickerOpen(false);
				}}
			/>
		</div>
	);
}
