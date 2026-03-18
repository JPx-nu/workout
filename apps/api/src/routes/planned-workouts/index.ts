/**
 * Planned Workouts REST API — CRUD endpoints for the calendar UI.
 *
 * All routes are protected by JWT auth + claims extraction
 * (applied in server.ts for /api/* routes).
 */

import {
	PlannedWorkoutBatchInput,
	PlannedWorkoutInput,
	PlannedWorkoutUpdate,
} from "@triathlon/types";
import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { getAuth } from "../../middleware/auth.js";
import { isResponse, parseBody } from "../../middleware/validate.js";
import { createAdminClient } from "../../services/ai/supabase.js";
import {
	createPlannedWorkout,
	scheduleSessionsBatch,
	updatePlannedWorkout,
} from "../../services/workout-center.js";

const log = createLogger({ module: "planned-workouts" });

export const plannedWorkoutsRoutes = new Hono();

// ── GET /api/planned-workouts ──────────────────────────────────
// Query params: from (ISO date), to (ISO date), status (optional)
plannedWorkoutsRoutes.get("/", async (c) => {
	const { userId, clubId } = getAuth(c);
	const from = c.req.query("from");
	const to = c.req.query("to");
	const status = c.req.query("status");

	if (!from || !to) {
		return c.json({ error: "Missing required query params: from, to" }, 400);
	}

	const supabase = createAdminClient();
	let query = supabase
		.from("planned_workouts")
		.select("*")
		.eq("athlete_id", userId)
		.eq("club_id", clubId)
		.gte("planned_date", from)
		.lte("planned_date", to)
		.order("planned_date", { ascending: true })
		.order("sort_order", { ascending: true })
		.limit(200);

	if (status) {
		query = query.eq("status", status);
	}

	const { data, error } = await query;

	if (error) {
		log.error({ err: error }, "Failed to fetch planned workouts");
		return c.json({ error: error.message }, 500);
	}

	return c.json({ data });
});

// ── GET /api/planned-workouts/:id ──────────────────────────────
plannedWorkoutsRoutes.get("/:id", async (c) => {
	const { userId } = getAuth(c);
	const id = c.req.param("id");
	const supabase = createAdminClient();

	const { data, error } = await supabase
		.from("planned_workouts")
		.select("*")
		.eq("id", id)
		.eq("athlete_id", userId)
		.single();

	if (error || !data) {
		return c.json({ error: "Planned workout not found" }, 404);
	}

	return c.json({ data });
});

// ── POST /api/planned-workouts ─────────────────────────────────
plannedWorkoutsRoutes.post("/", async (c) => {
	const { userId, clubId } = getAuth(c);
	const body = await parseBody(c, PlannedWorkoutInput);
	if (isResponse(body)) return body;

	try {
		const supabase = createAdminClient();
		const data = await createPlannedWorkout(supabase, {
			...body,
			athleteId: userId,
			clubId,
		});
		return c.json({ data }, 201);
	} catch (error) {
		log.error({ err: error }, "Failed to create planned workout");
		return c.json(
			{
				error: error instanceof Error ? error.message : "Failed to create planned workout",
			},
			500,
		);
	}
});

plannedWorkoutsRoutes.post("/batch", async (c) => {
	const { userId, clubId } = getAuth(c);
	const body = await parseBody(c, PlannedWorkoutBatchInput);
	if (isResponse(body)) return body;

	try {
		const supabase = createAdminClient();
		const data = await scheduleSessionsBatch(supabase, {
			athleteId: userId,
			clubId,
			workouts: body.workouts,
		});
		return c.json({ data }, 201);
	} catch (error) {
		log.error({ err: error, userId }, "Failed to batch schedule workouts");
		return c.json(
			{
				error: error instanceof Error ? error.message : "Failed to batch schedule workouts",
			},
			500,
		);
	}
});

// ── PATCH /api/planned-workouts/:id ────────────────────────────
// Supports partial updates (drag-drop reschedule, inline edit)
plannedWorkoutsRoutes.patch("/:id", async (c) => {
	const { userId } = getAuth(c);
	const id = c.req.param("id");
	const body = await parseBody(c, PlannedWorkoutUpdate);
	if (isResponse(body)) return body;

	if (Object.keys(body).length === 0) {
		return c.json({ error: "No fields to update" }, 400);
	}

	try {
		const supabase = createAdminClient();
		const data = await updatePlannedWorkout(supabase, id, userId, body);
		return c.json({ data });
	} catch (error) {
		log.error({ err: error }, "Failed to update planned workout");
		return c.json(
			{
				error: error instanceof Error ? error.message : "Failed to update planned workout",
			},
			500,
		);
	}
});

// ── PATCH /api/planned-workouts/:id/complete ───────────────────
// Mark as completed and optionally link to a workout record
plannedWorkoutsRoutes.patch("/:id/complete", async (c) => {
	const { userId } = getAuth(c);
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));

	const supabase = createAdminClient();
	const { data, error } = await supabase
		.from("planned_workouts")
		.update({
			status: "completed",
			workout_id: body.workoutId || null,
		})
		.eq("id", id)
		.eq("athlete_id", userId)
		.select()
		.single();

	if (error) {
		log.error({ err: error }, "Failed to complete planned workout");
		return c.json({ error: error.message }, 500);
	}

	return c.json({ data });
});

// ── DELETE /api/planned-workouts/:id ───────────────────────────
plannedWorkoutsRoutes.delete("/:id", async (c) => {
	const { userId } = getAuth(c);
	const id = c.req.param("id");

	const supabase = createAdminClient();
	const { error } = await supabase
		.from("planned_workouts")
		.delete()
		.eq("id", id)
		.eq("athlete_id", userId);

	if (error) {
		log.error({ err: error }, "Failed to delete planned workout");
		return c.json({ error: error.message }, 500);
	}

	return c.json({ success: true });
});
