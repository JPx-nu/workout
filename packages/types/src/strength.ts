import { z } from "zod/v4";

export const MuscleGroupSchema = z.enum([
	"chest",
	"back",
	"legs",
	"shoulders",
	"arms",
	"core",
	"full",
	"glutes",
	"hamstrings",
	"quads",
	"calves",
]);
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>;

export const StrengthSetTypeSchema = z.enum([
	"working",
	"warmup",
	"dropset",
	"backoff",
	"amrap",
	"cluster",
]);
export type StrengthSetType = z.infer<typeof StrengthSetTypeSchema>;

export const StrengthGroupTypeSchema = z.enum(["superset", "circuit", "giant_set"]);
export type StrengthGroupType = z.infer<typeof StrengthGroupTypeSchema>;

export const StrengthEquipmentSchema = z.enum([
	"barbell",
	"dumbbell",
	"machine",
	"cable",
	"bodyweight",
	"kettlebell",
	"smith_machine",
	"plate_loaded_machine",
	"band",
	"other",
]);
export type StrengthEquipment = z.infer<typeof StrengthEquipmentSchema>;

export const StrengthMovementPatternSchema = z.enum([
	"squat",
	"hinge",
	"horizontal_push",
	"vertical_push",
	"horizontal_pull",
	"vertical_pull",
	"single_leg",
	"carry",
	"core",
	"isolation",
	"other",
]);
export type StrengthMovementPattern = z.infer<typeof StrengthMovementPatternSchema>;

export const StrengthCatalogSourceSchema = z.enum(["starter", "custom"]);
export type StrengthCatalogSource = z.infer<typeof StrengthCatalogSourceSchema>;

export const StrengthSessionModeSchema = z.enum(["start_now", "log_past", "schedule"]);
export type StrengthSessionMode = z.infer<typeof StrengthSessionModeSchema>;

export const StrengthSessionStatusSchema = z.enum(["draft", "in_progress", "planned", "completed"]);
export type StrengthSessionStatus = z.infer<typeof StrengthSessionStatusSchema>;

export const StrengthSetSchema = z.object({
	id: z.string().min(1),
	order: z.number().int().min(1),
	setType: StrengthSetTypeSchema.default("working"),
	completed: z.boolean().default(false),
	reps: z.number().int().min(0).optional(),
	weightKg: z.number().min(0).optional(),
	rpe: z.number().min(1).max(10).optional(),
	rir: z.number().int().min(0).max(6).optional(),
	tempo: z.string().max(32).optional(),
	durationSec: z.number().int().min(0).optional(),
	distanceM: z.number().min(0).optional(),
	notes: z.string().max(500).optional(),
});
export type StrengthSet = z.infer<typeof StrengthSetSchema>;

export const StrengthExerciseSchema = z.object({
	id: z.string().min(1),
	catalogId: z.string().min(1).optional(),
	displayName: z.string().min(1),
	isCustom: z.boolean().default(false),
	equipment: StrengthEquipmentSchema.default("other"),
	movementPattern: StrengthMovementPatternSchema.default("other"),
	primaryMuscleGroups: z.array(MuscleGroupSchema).min(1).default(["full"]),
	notes: z.string().max(1000).optional(),
	restSec: z.number().int().min(0).optional(),
	groupId: z.number().int().positive().optional(),
	groupType: StrengthGroupTypeSchema.optional(),
	sets: z.array(StrengthSetSchema).default([]),
});
export type StrengthExercise = z.infer<typeof StrengthExerciseSchema>;

export const StrengthSessionV1Schema = z.object({
	schemaVersion: z.literal(1),
	activityType: z.literal("STRENGTH"),
	mode: StrengthSessionModeSchema,
	status: StrengthSessionStatusSchema,
	source: z.enum(["AI", "COACH", "MANUAL"]).default("MANUAL"),
	focus: z.string().max(160).optional(),
	startedAt: z.iso.datetime().optional(),
	endedAt: z.iso.datetime().optional(),
	plannedDate: z.iso.date().optional(),
	plannedTime: z.string().max(5).optional(),
	durationSec: z.number().int().min(0).optional(),
	sessionNotes: z.string().max(2000).optional(),
	exercises: z.array(StrengthExerciseSchema).default([]),
});
export type StrengthSessionV1 = z.infer<typeof StrengthSessionV1Schema>;

export const StrengthSessionDataSchema = StrengthSessionV1Schema;
export type StrengthSessionData = StrengthSessionV1;

export const StrengthExerciseCatalogItemSchema = z.object({
	id: z.string().min(1),
	displayName: z.string().min(1),
	aliases: z.array(z.string().min(1)).default([]),
	equipment: z.array(StrengthEquipmentSchema).min(1),
	movementPattern: StrengthMovementPatternSchema,
	primaryMuscleGroups: z.array(MuscleGroupSchema).min(1),
	catalogSource: StrengthCatalogSourceSchema.default("starter"),
});
export type StrengthExerciseCatalogItem = z.infer<typeof StrengthExerciseCatalogItemSchema>;
