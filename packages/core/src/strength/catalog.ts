import type {
	MuscleGroup,
	StrengthExerciseCatalogItem,
	StrengthMovementPattern,
} from "@triathlon/types";

function createCatalogItem(
	id: string,
	displayName: string,
	aliases: string[],
	equipment: StrengthExerciseCatalogItem["equipment"],
	movementPattern: StrengthMovementPattern,
	primaryMuscleGroups: MuscleGroup[],
): StrengthExerciseCatalogItem {
	return {
		id,
		displayName,
		aliases,
		equipment,
		movementPattern,
		primaryMuscleGroups,
		catalogSource: "starter",
	};
}

export const strengthExerciseCatalog: StrengthExerciseCatalogItem[] = [
	createCatalogItem(
		"barbell-back-squat",
		"Barbell Back Squat",
		["back squat", "bb squat", "squat"],
		["barbell"],
		"squat",
		["legs", "quads", "glutes"],
	),
	createCatalogItem("front-squat", "Front Squat", ["front squat"], ["barbell"], "squat", [
		"legs",
		"quads",
		"core",
	]),
	createCatalogItem(
		"leg-press",
		"Leg Press",
		["45 degree leg press", "sled leg press"],
		["machine", "plate_loaded_machine"],
		"squat",
		["legs", "quads", "glutes"],
	),
	createCatalogItem(
		"deadlift",
		"Deadlift",
		["conventional deadlift", "barbell deadlift"],
		["barbell"],
		"hinge",
		["back", "hamstrings", "glutes"],
	),
	createCatalogItem(
		"romanian-deadlift",
		"Romanian Deadlift",
		["rdl", "romanian deadlift"],
		["barbell", "dumbbell"],
		"hinge",
		["hamstrings", "glutes", "back"],
	),
	createCatalogItem(
		"barbell-bench-press",
		"Barbell Bench Press",
		["bench press", "flat bench", "bb bench"],
		["barbell"],
		"horizontal_push",
		["chest", "shoulders", "arms"],
	),
	createCatalogItem(
		"incline-dumbbell-press",
		"Incline Dumbbell Press",
		["incline db press", "incline dumbbell bench"],
		["dumbbell"],
		"horizontal_push",
		["chest", "shoulders", "arms"],
	),
	createCatalogItem(
		"seated-chest-press",
		"Seated Chest Press",
		["machine chest press", "chest press machine"],
		["machine"],
		"horizontal_push",
		["chest", "shoulders", "arms"],
	),
	createCatalogItem(
		"overhead-press",
		"Overhead Press",
		["shoulder press", "military press", "ohp"],
		["barbell", "dumbbell"],
		"vertical_push",
		["shoulders", "arms", "core"],
	),
	createCatalogItem(
		"lat-pulldown",
		"Lat Pulldown",
		["lat pull down", "pulldown"],
		["cable", "machine"],
		"vertical_pull",
		["back", "arms"],
	),
	createCatalogItem(
		"pull-up",
		"Pull-Up",
		["chin up", "bodyweight pull up"],
		["bodyweight"],
		"vertical_pull",
		["back", "arms", "core"],
	),
	createCatalogItem(
		"seated-cable-row",
		"Seated Cable Row",
		["cable row", "seated row"],
		["cable"],
		"horizontal_pull",
		["back", "arms"],
	),
	createCatalogItem(
		"chest-supported-row",
		"Chest Supported Row",
		["machine row", "t-bar row"],
		["machine", "plate_loaded_machine", "dumbbell"],
		"horizontal_pull",
		["back", "arms"],
	),
	createCatalogItem(
		"hip-thrust",
		"Hip Thrust",
		["barbell hip thrust", "glute bridge"],
		["barbell", "machine"],
		"hinge",
		["glutes", "hamstrings"],
	),
	createCatalogItem(
		"leg-extension",
		"Leg Extension",
		["quad extension"],
		["machine"],
		"isolation",
		["quads", "legs"],
	),
	createCatalogItem(
		"lying-leg-curl",
		"Lying Leg Curl",
		["leg curl", "hamstring curl"],
		["machine"],
		"isolation",
		["hamstrings", "legs"],
	),
	createCatalogItem(
		"standing-calf-raise",
		"Standing Calf Raise",
		["calf raise", "machine calf raise"],
		["machine", "bodyweight"],
		"isolation",
		["calves", "legs"],
	),
	createCatalogItem(
		"lateral-raise",
		"Lateral Raise",
		["db lateral raise", "machine lateral raise"],
		["dumbbell", "machine", "cable"],
		"isolation",
		["shoulders"],
	),
	createCatalogItem("face-pull", "Face Pull", ["rope face pull"], ["cable"], "horizontal_pull", [
		"shoulders",
		"back",
	]),
	createCatalogItem(
		"biceps-curl",
		"Biceps Curl",
		["dumbbell curl", "barbell curl", "curl"],
		["dumbbell", "barbell", "cable", "machine"],
		"isolation",
		["arms"],
	),
	createCatalogItem(
		"triceps-pressdown",
		"Triceps Pressdown",
		["cable pushdown", "rope pushdown"],
		["cable"],
		"isolation",
		["arms"],
	),
	createCatalogItem(
		"cable-crunch",
		"Cable Crunch",
		["kneeling cable crunch", "ab crunch"],
		["cable"],
		"core",
		["core"],
	),
];

export function searchStrengthExerciseCatalog(query: string): StrengthExerciseCatalogItem[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return strengthExerciseCatalog;
	}

	return strengthExerciseCatalog.filter((item) => {
		if (item.displayName.toLowerCase().includes(normalized)) {
			return true;
		}
		return item.aliases.some((alias) => alias.toLowerCase().includes(normalized));
	});
}

export function findStrengthExerciseCatalogItem(
	nameOrId: string | null | undefined,
): StrengthExerciseCatalogItem | null {
	if (!nameOrId) {
		return null;
	}

	const normalized = nameOrId.trim().toLowerCase();
	return (
		strengthExerciseCatalog.find(
			(item) =>
				item.id === normalized ||
				item.displayName.toLowerCase() === normalized ||
				item.aliases.some((alias) => alias.toLowerCase() === normalized),
		) ?? null
	);
}
