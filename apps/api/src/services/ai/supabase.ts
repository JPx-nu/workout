// ============================================================
// Server-side Supabase Client for AI Agent
// Creates authenticated clients for data access.
// Designed as reusable service layer — tools are thin wrappers.
// Future: expose same functions via REST for external agents.
// ============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Creates a Supabase admin client (bypasses RLS).
 * Use sparingly — prefer user-scoped client when possible.
 */
export function createAdminClient(): SupabaseClient {
	return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false },
	});
}

/**
 * Creates a Supabase client scoped to a specific user's JWT.
 * Uses the anon key so RLS policies are enforced and auth.jwt()
 * correctly returns the user's token claims (including app_metadata).
 * The service_role key bypasses RLS, which breaks requesting_club_id().
 */
export function createUserClient(userJwt: string): SupabaseClient {
	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${userJwt}` },
		},
	});
}

// ── Typed interfaces matching DB schema (00002_create_core_tables.sql) ──

export interface AthleteProfile {
	id: string;
	club_id: string;
	role: string;
	display_name: string | null;
	avatar_url: string | null;
	timezone: string;
	preferences: Record<string, unknown>;
	created_at: string;
	updated_at: string;
}

export interface Workout {
	id: string;
	athlete_id: string;
	club_id: string;
	activity_type: string;
	source: string;
	started_at: string;
	duration_s: number | null;
	distance_m: number | null;
	avg_hr: number | null;
	max_hr: number | null;
	avg_pace_s_km: number | null;
	avg_power_w: number | null;
	calories: number | null;
	tss: number | null;
	raw_data: Record<string, unknown> | null;
	notes: string | null;
	embedding?: number[];
	created_at: string;
}

export interface DailyLog {
	id: string;
	athlete_id: string;
	club_id: string;
	log_date: string;
	sleep_hours: number | null;
	sleep_quality: number | null;
	rpe: number | null;
	mood: number | null;
	hrv: number | null;
	resting_hr: number | null;
	weight_kg: number | null;
	notes: string | null;
	created_at: string;
}

export interface TrainingPlan {
	id: string;
	athlete_id: string;
	club_id: string;
	event_id: string | null;
	name: string;
	status: string;
	plan_data: unknown; // JSONB
	created_at: string;
}

export interface HealthMetric {
	id: string;
	athlete_id: string;
	club_id: string;
	metric_type: string;
	value: number;
	unit: string | null;
	recorded_at: string;
	source: string | null;
	raw_data: Record<string, unknown> | null;
	created_at: string;
}

export interface AthleteMemory {
	id: string;
	athlete_id: string;
	category: string;
	content: string;
	embedding?: number[];
	importance: number;
	created_at: string;
	updated_at: string;
}

// ── Read services ─────────────────────────────────────────────

export async function getProfile(
	client: SupabaseClient,
	userId: string,
): Promise<AthleteProfile | null> {
	const { data, error } = await client
		.from("profiles")
		.select("*")
		.eq("id", userId)
		.single();

	if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
	return data;
}

export async function getWorkouts(
	client: SupabaseClient,
	userId: string,
	options: {
		limit?: number;
		fromDate?: string;
		toDate?: string;
		activityType?: string;
	} = {},
): Promise<Workout[]> {
	let query = client
		.from("workouts")
		.select("*")
		.eq("athlete_id", userId)
		.order("started_at", { ascending: false });

	if (options.fromDate) query = query.gte("started_at", options.fromDate);
	if (options.toDate) query = query.lte("started_at", options.toDate);
	if (options.activityType)
		query = query.eq("activity_type", options.activityType);
	if (options.limit) query = query.limit(options.limit);

	const { data, error } = await query;
	if (error) throw new Error(`Failed to fetch workouts: ${error.message}`);
	return data ?? [];
}

export async function getDailyLogs(
	client: SupabaseClient,
	userId: string,
	options: { limit?: number; fromDate?: string; toDate?: string } = {},
): Promise<DailyLog[]> {
	let query = client
		.from("daily_logs")
		.select("*")
		.eq("athlete_id", userId)
		.order("log_date", { ascending: false });

	if (options.fromDate) query = query.gte("log_date", options.fromDate);
	if (options.toDate) query = query.lte("log_date", options.toDate);
	if (options.limit) query = query.limit(options.limit);

	const { data, error } = await query;
	if (error) throw new Error(`Failed to fetch daily logs: ${error.message}`);
	return data ?? [];
}

export async function getHealthMetrics(
	client: SupabaseClient,
	userId: string,
	options: { limit?: number; metricType?: string; fromDate?: string } = {},
): Promise<HealthMetric[]> {
	let query = client
		.from("health_metrics")
		.select("*")
		.eq("athlete_id", userId)
		.order("recorded_at", { ascending: false });

	if (options.metricType) query = query.eq("metric_type", options.metricType);
	if (options.fromDate) query = query.gte("recorded_at", options.fromDate);
	if (options.limit) query = query.limit(options.limit);

	const { data, error } = await query;
	if (error)
		throw new Error(`Failed to fetch health metrics: ${error.message}`);
	return data ?? [];
}

export async function getTrainingPlan(
	client: SupabaseClient,
	userId: string,
): Promise<TrainingPlan | null> {
	const { data, error } = await client
		.from("training_plans")
		.select("*")
		.eq("athlete_id", userId)
		.eq("status", "active")
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (error) throw new Error(`Failed to fetch training plan: ${error.message}`);
	return data;
}

export async function getUpcomingEvents(
	client: SupabaseClient,
	userId: string,
	limit = 5,
): Promise<
	Array<{
		id: string;
		name: string;
		event_date: string;
		distance_type: string | null;
	}>
> {
	const today = new Date().toISOString().split("T")[0];
	// Events are club-scoped, not athlete-scoped. Query via the athlete's club.
	const profile = await getProfile(client, userId);
	if (!profile) return [];

	const { data, error } = await client
		.from("events")
		.select("id, name, event_date, distance_type")
		.eq("club_id", profile.club_id)
		.gte("event_date", today)
		.order("event_date", { ascending: true })
		.limit(limit);

	if (error) throw new Error(`Failed to fetch events: ${error.message}`);
	return data ?? [];
}

export async function getInjuries(
	client: SupabaseClient,
	userId: string,
	activeOnly = true,
): Promise<
	Array<{
		id: string;
		body_part: string;
		severity: number | null;
		reported_at: string;
		resolved_at: string | null;
		notes: string | null;
	}>
> {
	let query = client
		.from("injuries")
		.select("id, body_part, severity, reported_at, resolved_at, notes")
		.eq("athlete_id", userId)
		.order("reported_at", { ascending: false });

	if (activeOnly) query = query.is("resolved_at", null);

	const { data, error } = await query;
	if (error) throw new Error(`Failed to fetch injuries: ${error.message}`);
	return data ?? [];
}

export async function getRecentMemories(
	client: SupabaseClient,
	userId: string,
	limit = 10,
): Promise<AthleteMemory[]> {
	const { data, error } = await client
		.from("athlete_memories")
		.select("*")
		.eq("athlete_id", userId)
		.order("importance", { ascending: false })
		.order("created_at", { ascending: false })
		.limit(limit);

	if (error) throw new Error(`Failed to fetch memories: ${error.message}`);
	return data ?? [];
}

// ── Write services ────────────────────────────────────────────

export async function insertWorkout(
	client: SupabaseClient,
	workout: Omit<Workout, "id" | "created_at">,
): Promise<Workout> {
	const { data, error } = await client
		.from("workouts")
		.insert(workout)
		.select()
		.single();

	if (error) throw new Error(`Failed to log workout: ${error.message}`);
	return data;
}

export async function insertMemory(
	client: SupabaseClient,
	memory: Omit<AthleteMemory, "id" | "created_at" | "updated_at">,
): Promise<AthleteMemory> {
	const { data, error } = await client
		.from("athlete_memories")
		.insert(memory)
		.select()
		.single();

	if (error) throw new Error(`Failed to save memory: ${error.message}`);
	return data;
}

export async function upsertDailyLog(
	client: SupabaseClient,
	log: Omit<DailyLog, "id" | "created_at">,
): Promise<DailyLog> {
	const { data, error } = await client
		.from("daily_logs")
		.upsert(log, { onConflict: "athlete_id,log_date" })
		.select()
		.single();

	if (error) throw new Error(`Failed to update daily log: ${error.message}`);
	return data;
}

export async function updateTrainingPlan(
	client: SupabaseClient,
	planId: string,
	updates: Partial<Pick<TrainingPlan, "plan_data" | "status">>,
): Promise<TrainingPlan> {
	const { data, error } = await client
		.from("training_plans")
		.update(updates)
		.eq("id", planId)
		.select()
		.single();

	if (error)
		throw new Error(`Failed to update training plan: ${error.message}`);
	return data;
}
