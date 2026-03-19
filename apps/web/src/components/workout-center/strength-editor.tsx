"use client";

import type { StrengthExercise } from "@triathlon/types";
import {
	ArrowDown,
	ArrowUp,
	Copy,
	Dumbbell,
	Flame,
	GripVertical,
	Plus,
	Trash2,
} from "lucide-react";
import {
	createEmptyStrengthSet,
	type PreviousStrengthExercise,
	type WorkoutCenterMode,
} from "./model";

function parseInteger(value: string): number | undefined {
	if (!value.trim()) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumber(value: string): number | undefined {
	if (!value.trim()) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

type StrengthEditorProps = {
	mode: WorkoutCenterMode;
	exercises: StrengthExercise[];
	previousLookup: Record<string, PreviousStrengthExercise>;
	onChange: (exercises: StrengthExercise[]) => void;
	onOpenPicker: () => void;
	onStartRest: (seconds: number, exerciseName: string) => void;
};

export function StrengthEditor({
	mode,
	exercises,
	previousLookup,
	onChange,
	onOpenPicker,
	onStartRest,
}: StrengthEditorProps) {
	function updateExercise(
		exerciseId: string,
		updater: (exercise: StrengthExercise) => StrengthExercise,
	) {
		onChange(
			exercises.map((exercise) => (exercise.id === exerciseId ? updater(exercise) : exercise)),
		);
	}

	function reorderExercises(exerciseId: string, direction: -1 | 1) {
		const index = exercises.findIndex((exercise) => exercise.id === exerciseId);
		const nextIndex = index + direction;
		if (index < 0 || nextIndex < 0 || nextIndex >= exercises.length) {
			return;
		}

		const next = [...exercises];
		const [moved] = next.splice(index, 1);
		next.splice(nextIndex, 0, moved);
		onChange(next);
	}

	function removeExercise(exerciseId: string) {
		const remaining = exercises.filter((exercise) => exercise.id !== exerciseId);
		onChange(remaining);
	}

	function updateSet(
		exerciseId: string,
		setId: string,
		updater: (
			set: StrengthExercise["sets"][number],
			setIndex: number,
		) => StrengthExercise["sets"][number],
	) {
		updateExercise(exerciseId, (exercise) => ({
			...exercise,
			sets: exercise.sets.map((set, index) => (set.id === setId ? updater(set, index) : set)),
		}));
	}

	function addSet(exerciseId: string) {
		updateExercise(exerciseId, (exercise) => ({
			...exercise,
			sets: [...exercise.sets, createEmptyStrengthSet(exercise.sets.length + 1)],
		}));
	}

	function duplicateLastSet(exerciseId: string) {
		updateExercise(exerciseId, (exercise) => {
			const lastSet = exercise.sets.at(-1);
			if (!lastSet) {
				return {
					...exercise,
					sets: [createEmptyStrengthSet(1)],
				};
			}

			return {
				...exercise,
				sets: [
					...exercise.sets,
					{
						...lastSet,
						id: crypto.randomUUID(),
						order: exercise.sets.length + 1,
						completed: false,
					},
				],
			};
		});
	}

	function removeSet(exerciseId: string, setId: string) {
		updateExercise(exerciseId, (exercise) => {
			const remaining = exercise.sets.filter((set) => set.id !== setId);
			return {
				...exercise,
				sets:
					remaining.length > 0
						? remaining.map((set, index) => ({ ...set, order: index + 1 }))
						: [createEmptyStrengthSet(1)],
			};
		});
	}

	return (
		<div className="space-y-4" data-testid="strength-editor">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">Strength Builder</h2>
					<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
						Build the session exercise by exercise. Keep the top rows lean; use More details when
						you need rest, tempo, RIR, or grouping.
					</p>
				</div>

				<button
					type="button"
					onClick={onOpenPicker}
					data-testid="add-exercise-button"
					className="btn-primary text-sm px-4 py-2"
				>
					<Plus size={14} className="inline-block mr-1" />
					Add exercise
				</button>
			</div>

			<div className="space-y-4">
				{exercises.length === 0 && (
					<section
						className="glass-card p-5 text-sm"
						data-testid="strength-empty-state"
						style={{ color: "var(--color-text-secondary)" }}
					>
						<p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
							Start with the main lift or machine you want to track.
						</p>
						<p className="mt-2">
							Add an exercise to pull from the shared library, recent strength history, or a custom
							machine name.
						</p>
						<button type="button" onClick={onOpenPicker} className="btn-primary mt-4 text-sm">
							Add first exercise
						</button>
					</section>
				)}
				{exercises.map((exercise) => {
					const previous =
						previousLookup[exercise.catalogId ?? exercise.displayName.toLowerCase()] ?? null;

					return (
						<section
							key={exercise.id}
							className="glass-card p-4 lg:p-5 space-y-4"
							data-testid={`exercise-card-${exercise.displayName.toLowerCase().replaceAll(" ", "-")}`}
						>
							<div className="flex flex-wrap items-start justify-between gap-3">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span
											className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
											style={{
												background: "color-mix(in oklch, var(--color-strength), transparent 82%)",
											}}
										>
											<Dumbbell size={16} style={{ color: "var(--color-strength)" }} />
										</span>
										<div className="min-w-0">
											<div className="text-sm font-semibold truncate">{exercise.displayName}</div>
											<div
												className="text-xs flex flex-wrap items-center gap-2"
												style={{ color: "var(--color-text-muted)" }}
											>
												<span>{exercise.equipment.replaceAll("_", " ")}</span>
												<span>/</span>
												<span>{exercise.movementPattern.replaceAll("_", " ")}</span>
												{!!exercise.primaryMuscleGroups.length && (
													<>
														<span>/</span>
														<span>{exercise.primaryMuscleGroups.join(", ")}</span>
													</>
												)}
											</div>
										</div>
									</div>

									{previous && (
										<div
											className="mt-3 rounded-xl px-3 py-2 text-xs"
											style={{
												background: "var(--color-glass-bg-subtle)",
												color: "var(--color-text-secondary)",
											}}
										>
											Last time:{" "}
											{new Date(previous.startedAt).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
											})}
											{" / "}
											{previous.sets
												.filter((set) => set.weightKg !== undefined || set.reps !== undefined)
												.slice(0, 2)
												.map((set) => `${set.weightKg ?? 0} kg x ${set.reps ?? 0}`)
												.join(", ") || "No logged sets"}
											{previous.notes ? ` / ${previous.notes}` : ""}
										</div>
									)}
								</div>

								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => reorderExercises(exercise.id, -1)}
										className="rounded-lg border px-2 py-2 text-xs hover-surface"
										style={{ borderColor: "var(--color-glass-border)" }}
										aria-label={`Move ${exercise.displayName} up`}
									>
										<ArrowUp size={14} />
									</button>
									<button
										type="button"
										onClick={() => reorderExercises(exercise.id, 1)}
										className="rounded-lg border px-2 py-2 text-xs hover-surface"
										style={{ borderColor: "var(--color-glass-border)" }}
										aria-label={`Move ${exercise.displayName} down`}
									>
										<ArrowDown size={14} />
									</button>
									<button
										type="button"
										onClick={() => removeExercise(exercise.id)}
										className="rounded-lg border px-2 py-2 text-xs hover-surface"
										style={{
											borderColor: "var(--color-glass-border)",
											color: "var(--color-danger)",
										}}
										aria-label={`Remove ${exercise.displayName}`}
									>
										<Trash2 size={14} />
									</button>
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full min-w-[720px] text-sm">
									<thead>
										<tr style={{ color: "var(--color-text-muted)" }}>
											<th className="pb-2 text-left font-medium">Set</th>
											{mode === "start_now" && <th className="pb-2 text-left font-medium">Done</th>}
											<th className="pb-2 text-left font-medium">Type</th>
											<th className="pb-2 text-left font-medium">Weight</th>
											<th className="pb-2 text-left font-medium">Reps</th>
											<th className="pb-2 text-left font-medium">RPE</th>
											<th className="pb-2 text-left font-medium">Actions</th>
										</tr>
									</thead>
									<tbody>
										{exercise.sets.map((set, setIndex) => (
											<tr
												key={set.id}
												className="border-t"
												style={{ borderColor: "var(--color-glass-border)" }}
											>
												<td className="py-2 pr-3 align-top">
													<div className="flex items-center gap-2">
														<GripVertical size={14} style={{ color: "var(--color-text-muted)" }} />
														<span className="font-medium">{setIndex + 1}</span>
													</div>
												</td>
												{mode === "start_now" && (
													<td className="py-2 pr-3 align-top">
														<label className="inline-flex items-center gap-2 text-xs">
															<input
																type="checkbox"
																checked={set.completed}
																onChange={(event) => {
																	const nextCompleted = event.target.checked;
																	updateSet(exercise.id, set.id, (currentSet, index) => ({
																		...currentSet,
																		order: index + 1,
																		completed: nextCompleted,
																	}));
																	if (nextCompleted && exercise.restSec) {
																		onStartRest(exercise.restSec, exercise.displayName);
																	}
																}}
															/>
															<span>Complete</span>
														</label>
													</td>
												)}
												<td className="py-2 pr-3 align-top">
													<select
														value={set.setType}
														onChange={(event) =>
															updateSet(exercise.id, set.id, (currentSet, index) => ({
																...currentSet,
																order: index + 1,
																setType: event.target
																	.value as StrengthExercise["sets"][number]["setType"],
															}))
														}
														className="glass-input w-full min-w-[120px]"
													>
														<option value="working">Working</option>
														<option value="warmup">Warm-up</option>
														<option value="backoff">Backoff</option>
														<option value="dropset">Dropset</option>
														<option value="amrap">AMRAP</option>
														<option value="cluster">Cluster</option>
													</select>
												</td>
												<td className="py-2 pr-3 align-top">
													<input
														type="number"
														inputMode="decimal"
														min="0"
														step="0.5"
														value={set.weightKg ?? ""}
														onChange={(event) =>
															updateSet(exercise.id, set.id, (currentSet, index) => ({
																...currentSet,
																order: index + 1,
																weightKg: parseNumber(event.target.value),
															}))
														}
														className="glass-input w-full min-w-[110px]"
														aria-label={`Weight for set ${setIndex + 1}`}
													/>
												</td>
												<td className="py-2 pr-3 align-top">
													<input
														type="number"
														inputMode="numeric"
														min="0"
														step="1"
														value={set.reps ?? ""}
														onChange={(event) =>
															updateSet(exercise.id, set.id, (currentSet, index) => ({
																...currentSet,
																order: index + 1,
																reps: parseInteger(event.target.value),
															}))
														}
														className="glass-input w-full min-w-[90px]"
														aria-label={`Reps for set ${setIndex + 1}`}
													/>
												</td>
												<td className="py-2 pr-3 align-top">
													<input
														type="number"
														inputMode="decimal"
														min="1"
														max="10"
														step="0.5"
														value={set.rpe ?? ""}
														onChange={(event) =>
															updateSet(exercise.id, set.id, (currentSet, index) => ({
																...currentSet,
																order: index + 1,
																rpe: parseNumber(event.target.value),
															}))
														}
														className="glass-input w-full min-w-[90px]"
														aria-label={`RPE for set ${setIndex + 1}`}
													/>
												</td>
												<td className="py-2 align-top">
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() => removeSet(exercise.id, set.id)}
															className="rounded-lg border px-2 py-2 text-xs hover-surface"
															style={{ borderColor: "var(--color-glass-border)" }}
															aria-label={`Remove set ${setIndex + 1}`}
														>
															<Trash2 size={14} />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() => addSet(exercise.id)}
									className="rounded-lg border px-3 py-2 text-xs font-medium hover-surface"
									style={{ borderColor: "var(--color-glass-border)" }}
								>
									<Plus size={13} className="inline-block mr-1" />
									Add set
								</button>
								<button
									type="button"
									onClick={() => duplicateLastSet(exercise.id)}
									className="rounded-lg border px-3 py-2 text-xs font-medium hover-surface"
									style={{ borderColor: "var(--color-glass-border)" }}
								>
									<Copy size={13} className="inline-block mr-1" />
									Duplicate last set
								</button>
								{exercise.restSec ? (
									<span
										className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
										style={{
											background: "color-mix(in oklch, var(--color-brand), transparent 84%)",
											color: "var(--color-brand-light)",
										}}
									>
										<Flame size={12} />
										Rest {exercise.restSec}s
									</span>
								) : null}
							</div>

							<details
								className="rounded-xl border px-4 py-3"
								style={{ borderColor: "var(--color-glass-border)" }}
							>
								<summary className="cursor-pointer text-sm font-medium">More details</summary>
								<div className="mt-4 grid gap-4 md:grid-cols-2">
									<div>
										<label
											htmlFor={`${exercise.id}-rest`}
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											Rest timer (sec)
										</label>
										<input
											id={`${exercise.id}-rest`}
											type="number"
											min="0"
											step="15"
											value={exercise.restSec ?? ""}
											onChange={(event) =>
												updateExercise(exercise.id, (currentExercise) => ({
													...currentExercise,
													restSec: parseInteger(event.target.value),
												}))
											}
											className="glass-input w-full"
										/>
									</div>
									<div>
										<label
											htmlFor={`${exercise.id}-group-id`}
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											Group ID
										</label>
										<input
											id={`${exercise.id}-group-id`}
											type="number"
											min="1"
											step="1"
											value={exercise.groupId ?? ""}
											onChange={(event) =>
												updateExercise(exercise.id, (currentExercise) => ({
													...currentExercise,
													groupId: parseInteger(event.target.value),
												}))
											}
											className="glass-input w-full"
										/>
									</div>
									<div>
										<label
											htmlFor={`${exercise.id}-group-type`}
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											Group type
										</label>
										<select
											id={`${exercise.id}-group-type`}
											value={exercise.groupType ?? ""}
											onChange={(event) =>
												updateExercise(exercise.id, (currentExercise) => ({
													...currentExercise,
													groupType:
														event.target.value === ""
															? undefined
															: (event.target.value as StrengthExercise["groupType"]),
												}))
											}
											className="glass-input w-full"
										>
											<option value="">None</option>
											<option value="superset">Superset</option>
											<option value="circuit">Circuit</option>
											<option value="giant_set">Giant set</option>
										</select>
									</div>
									<div>
										<label
											htmlFor={`${exercise.id}-notes`}
											className="mb-1.5 block text-xs font-medium"
											style={{ color: "var(--color-text-muted)" }}
										>
											Exercise note
										</label>
										<textarea
											id={`${exercise.id}-notes`}
											value={exercise.notes ?? ""}
											onChange={(event) =>
												updateExercise(exercise.id, (currentExercise) => ({
													...currentExercise,
													notes: event.target.value,
												}))
											}
											className="glass-input min-h-24 w-full"
										/>
									</div>
								</div>
							</details>
						</section>
					);
				})}
			</div>
		</div>
	);
}
