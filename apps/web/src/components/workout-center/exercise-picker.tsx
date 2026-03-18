"use client";

import { searchStrengthExerciseCatalog } from "@triathlon/core";
import type { StrengthExerciseCatalogItem } from "@triathlon/types";
import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

type ExercisePickerProps = {
	open: boolean;
	recent: StrengthExerciseCatalogItem[];
	onClose: () => void;
	onPick: (item: StrengthExerciseCatalogItem | string) => void;
};

type PickerTab = "recent" | "library" | "custom";

export function ExercisePicker({ open, recent, onClose, onPick }: ExercisePickerProps) {
	const [tab, setTab] = useState<PickerTab>("recent");
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);

	const libraryResults = useMemo(
		() => searchStrengthExerciseCatalog(deferredQuery).slice(0, 24),
		[deferredQuery],
	);

	const recentResults = useMemo(() => {
		if (!deferredQuery.trim()) {
			return recent;
		}

		const normalized = deferredQuery.trim().toLowerCase();
		return recent.filter(
			(item) =>
				item.displayName.toLowerCase().includes(normalized) ||
				item.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
		);
	}, [deferredQuery, recent]);

	if (!open) {
		return null;
	}

	const results = tab === "recent" ? recentResults : libraryResults;
	const customName = query.trim();

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
			<button
				type="button"
				className="absolute inset-0"
				style={{ background: "var(--color-overlay)" }}
				onClick={onClose}
				aria-label="Close exercise picker"
			/>
			<div
				className="glass-card relative w-full max-w-2xl p-4 sm:p-6"
				role="dialog"
				aria-modal="true"
				aria-labelledby="exercise-picker-title"
			>
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 id="exercise-picker-title" className="text-lg font-semibold">
							Add an exercise
						</h2>
						<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
							Pick from your recent lifts, search the shared library, or create a custom machine or
							movement.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg border px-2 py-2 hover-surface"
						style={{ borderColor: "var(--color-glass-border)" }}
						aria-label="Close exercise picker"
					>
						<X size={16} />
					</button>
				</div>

				<div className="mt-4 space-y-4">
					<label className="block">
						<span className="sr-only">Search exercise library</span>
						<div className="relative">
							<Search
								size={15}
								className="absolute left-3 top-1/2 -translate-y-1/2"
								style={{ color: "var(--color-text-muted)" }}
							/>
							<input
								type="text"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search barbell, machine, row, press..."
								className="glass-input w-full pl-10"
							/>
						</div>
					</label>

					<div className="flex flex-wrap gap-2">
						{(
							[
								["recent", "Recent"],
								["library", "Library"],
								["custom", "Custom"],
							] as const
						).map(([value, label]) => {
							const active = tab === value;
							return (
								<button
									key={value}
									type="button"
									onClick={() => setTab(value)}
									className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
									style={
										active
											? {
													background: "color-mix(in oklch, var(--color-strength), transparent 78%)",
													color: "var(--color-strength)",
												}
											: {
													background: "var(--color-glass-bg-subtle)",
													color: "var(--color-text-secondary)",
												}
									}
								>
									{label}
								</button>
							);
						})}
					</div>

					{tab === "custom" ? (
						<div
							className="rounded-xl border p-4"
							style={{ borderColor: "var(--color-glass-border)" }}
						>
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Use this for machines or variations that are not in the shared starter catalog yet.
							</p>
							<button
								type="button"
								onClick={() => {
									if (!customName) {
										return;
									}
									onPick(customName);
									setQuery("");
									setTab("recent");
								}}
								disabled={!customName}
								className="btn-primary mt-4 text-sm disabled:opacity-50"
							>
								Create &quot;{customName || "Custom Exercise"}&quot;
							</button>
						</div>
					) : (
						<div className="grid gap-2 sm:grid-cols-2">
							{results.length === 0 ? (
								<div
									className="rounded-xl border p-4 text-sm"
									style={{
										borderColor: "var(--color-glass-border)",
										color: "var(--color-text-secondary)",
									}}
								>
									No matches yet. Switch to Custom to create this exercise directly.
								</div>
							) : (
								results.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => {
											onPick(item);
											setQuery("");
											setTab("recent");
										}}
										className="rounded-xl border p-4 text-left transition-colors hover-surface"
										style={{ borderColor: "var(--color-glass-border)" }}
									>
										<div className="text-sm font-semibold">{item.displayName}</div>
										<div className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
											{item.equipment.join(", ").replaceAll("_", " ")}
											{" · "}
											{item.movementPattern.replaceAll("_", " ")}
										</div>
										<div className="mt-2 flex flex-wrap gap-1">
											{item.primaryMuscleGroups.slice(0, 3).map((muscle) => (
												<span
													key={`${item.id}-${muscle}`}
													className="rounded-full px-2 py-0.5 text-[11px] font-medium"
													style={{
														background: "var(--color-glass-bg-subtle)",
														color: "var(--color-text-muted)",
													}}
												>
													{muscle}
												</span>
											))}
										</div>
									</button>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
