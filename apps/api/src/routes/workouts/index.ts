import { CompletedWorkoutInput, CompletedWorkoutUpdate } from "@triathlon/types";
import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { getAuth, getJwt } from "../../middleware/auth.js";
import { isResponse, parseBody } from "../../middleware/validate.js";
import { createUserClient } from "../../services/ai/supabase.js";
import { createCompletedWorkout, updateCompletedWorkout } from "../../services/workout-center.js";

const log = createLogger({ module: "workouts-routes" });

export const workoutsRoutes = new Hono();

workoutsRoutes.post("/", async (c) => {
	const { userId, clubId } = getAuth(c);
	const body = await parseBody(c, CompletedWorkoutInput);
	if (isResponse(body)) {
		return body;
	}

	try {
		const supabase = createUserClient(getJwt(c));
		const data = await createCompletedWorkout(supabase, {
			...body,
			athleteId: userId,
			clubId,
		});

		return c.json({ data }, 201);
	} catch (error) {
		log.error({ err: error, userId }, "Failed to create completed workout");
		return c.json(
			{
				error: error instanceof Error ? error.message : "Failed to create completed workout",
			},
			500,
		);
	}
});

workoutsRoutes.patch("/:id", async (c) => {
	const { userId } = getAuth(c);
	const id = c.req.param("id");
	const body = await parseBody(c, CompletedWorkoutUpdate);
	if (isResponse(body)) {
		return body;
	}

	try {
		const supabase = createUserClient(getJwt(c));
		const data = await updateCompletedWorkout(supabase, id, userId, body);
		return c.json({ data });
	} catch (error) {
		log.error({ err: error, userId, workoutId: id }, "Failed to update completed workout");
		return c.json(
			{
				error: error instanceof Error ? error.message : "Failed to update completed workout",
			},
			500,
		);
	}
});
