/**
 * Zod Validation Schemas — Runtime input validation at API boundaries
 *
 * Uses Zod 4 APIs:
 *   - z.interface() for API inputs (better optional/undefined handling)
 *   - z.email(), z.uuid() top-level format helpers
 *   - .toJSONSchema() available on all schemas
 *
 * @see https://zod.dev
 */

import { z } from "zod/v4";
import { ActivityType, Intensity, PlannedWorkoutStatus, WorkoutSource } from "./planned-workout.js";

// ── String Sanitizers ──────────────────────────────────────────

/** Strips HTML tags and trims whitespace */
const sanitizedString = z.string().transform((val) => val.replace(/<[^>]*>/g, "").trim());

// ── Chat Schemas ───────────────────────────────────────────────

export const ChatMessageInput = z.object({
	message: sanitizedString.pipe(
		z
			.string()
			.min(1, "Message cannot be empty")
			.max(4000, "Message too long (max 4000 characters)"),
	),
	conversationId: z.uuid().optional(),
	imageUrls: z.array(z.url()).max(3, "Maximum 3 images allowed").optional(),
});
export type ChatMessageInput = z.infer<typeof ChatMessageInput>;

// ── Data Source (single source of truth) ──────────────────────
export const DataSourceSchema = z.enum([
	"GARMIN",
	"POLAR",
	"WAHOO",
	"FORM",
	"MANUAL",
	"HEALTHKIT",
	"HEALTH_CONNECT",
]);
export type DataSource = z.infer<typeof DataSourceSchema>;

// ── Workout Schemas ────────────────────────────────────────────

export const WorkoutInput = z.object({
	activity_type: ActivityType,
	source: DataSourceSchema,
	started_at: z.iso.datetime({ message: "started_at must be ISO 8601 datetime" }),
	duration_s: z.number().int().positive(),
	distance_m: z.number().nonnegative(),
	avg_hr: z.number().int().min(30).max(250).optional(),
	max_hr: z.number().int().min(30).max(250).optional(),
	avg_pace_s_km: z.number().positive().optional(),
	avg_power_w: z.number().nonnegative().optional(),
	calories: z.number().int().nonnegative().optional(),
	tss: z.number().nonnegative().optional(),
	raw_data: z.record(z.string(), z.unknown()).optional(),
});
export type WorkoutInput = z.infer<typeof WorkoutInput>;

// ── Profile Schemas ────────────────────────────────────────────

export const ProfileUpdate = z.object({
	display_name: sanitizedString.pipe(z.string().min(1).max(100)).optional(),
	timezone: z.string().max(50).optional(),
	avatar_url: z.url().optional(),
	preferences: z.record(z.string(), z.unknown()).optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

// ── Daily Log Schemas ──────────────────────────────────────────

export const DailyLogInput = z.object({
	log_date: z.iso.date(),
	sleep_hours: z.number().min(0).max(24).optional(),
	sleep_quality: z.number().int().min(1).max(10).optional(),
	rpe: z.number().int().min(1).max(10).optional(),
	mood: z.number().int().min(1).max(10).optional(),
	hrv: z.number().nonnegative().optional(),
	resting_hr: z.number().int().min(20).max(200).optional(),
	weight_kg: z.number().min(20).max(300).optional(),
	notes: sanitizedString.pipe(z.string().max(2000)).optional(),
});
export type DailyLogInput = z.infer<typeof DailyLogInput>;

// ── Injury Schemas ─────────────────────────────────────────────

export const InjuryInput = z.object({
	body_part: sanitizedString.pipe(z.string().min(1).max(100)),
	severity: z.number().int().min(1).max(5),
	notes: sanitizedString.pipe(z.string().max(2000)).optional(),
});
export type InjuryInput = z.infer<typeof InjuryInput>;

// ── Planned Workout Schemas ────────────────────────────────────

export const PlannedWorkoutInput = z.object({
	plannedDate: z.iso.date({ message: "plannedDate must be ISO date (YYYY-MM-DD)" }),
	plannedTime: z.string().max(5).optional(),
	activityType: ActivityType,
	title: sanitizedString.pipe(z.string().min(1).max(200)),
	description: sanitizedString.pipe(z.string().max(2000)).optional(),
	durationMin: z.number().int().positive().optional(),
	distanceKm: z.number().nonnegative().optional(),
	targetTss: z.number().nonnegative().optional(),
	targetRpe: z.number().int().min(1).max(10).optional(),
	intensity: Intensity.optional(),
	sessionData: z.record(z.string(), z.unknown()).optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	notes: sanitizedString.pipe(z.string().max(2000)).optional(),
	coachNotes: sanitizedString.pipe(z.string().max(2000)).optional(),
	source: WorkoutSource.optional(),
	planId: z.uuid().optional(),
});
export type PlannedWorkoutInput = z.infer<typeof PlannedWorkoutInput>;

export const PlannedWorkoutUpdate = z.object({
	plannedDate: z.iso.date().optional(),
	plannedTime: z.string().max(5).optional(),
	activityType: ActivityType.optional(),
	title: sanitizedString.pipe(z.string().min(1).max(200)).optional(),
	description: sanitizedString.pipe(z.string().max(2000)).optional(),
	durationMin: z.number().int().positive().optional(),
	distanceKm: z.number().nonnegative().optional(),
	targetTss: z.number().nonnegative().optional(),
	targetRpe: z.number().int().min(1).max(10).optional(),
	intensity: Intensity.optional(),
	sessionData: z.record(z.string(), z.unknown()).optional(),
	status: PlannedWorkoutStatus.optional(),
	sortOrder: z.number().int().nonnegative().optional(),
	notes: sanitizedString.pipe(z.string().max(2000)).optional(),
	coachNotes: sanitizedString.pipe(z.string().max(2000)).optional(),
});
export type PlannedWorkoutUpdate = z.infer<typeof PlannedWorkoutUpdate>;

// ── Webhook Schemas ────────────────────────────────────────────

export const WebhookPayload = z.object({
	source: DataSourceSchema,
	payload: z.record(z.string(), z.unknown()),
	timestamp: z.iso.datetime().optional(),
});
export type WebhookPayload = z.infer<typeof WebhookPayload>;

// ── Environment Validation ─────────────────────────────────────

export const EnvSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.url(),
	NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	SUPABASE_JWT_SECRET: z.string().min(1),
	AZURE_OPENAI_ENDPOINT: z.url().optional(),
	AZURE_OPENAI_API_KEY: z.string().optional(),
	AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
	AZURE_OPENAI_API_VERSION: z.string().optional(),
	WEB_URL: z.url().optional(),
	API_URL: z.url().optional(),
	PORT: z.string().regex(/^\d+$/).optional(),
});
