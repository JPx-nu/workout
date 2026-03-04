import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MobileHealthIngestInput } from "@triathlon/types";
import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import { jsonProblem } from "../../lib/problem-details.js";
import { getAuth } from "../../middleware/auth.js";
import { isResponse, parseBody } from "../../middleware/validate.js";
import { createAdminClient } from "../../services/ai/supabase.js";

const log = createLogger({ module: "health-ingest-route" });

export const healthRoutes = new Hono();

function stableHash(input: unknown): string {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}

function makeWorkoutExternalId(workout: {
	externalId?: string;
	source: string;
	activityType: string;
	startedAt: string;
	durationS: number;
	distanceM?: number;
	avgHr?: number;
	maxHr?: number;
	calories?: number;
}): string {
	if (workout.externalId && workout.externalId.trim().length > 0) {
		return workout.externalId.trim();
	}
	return `wkt_${stableHash({
		s: workout.source,
		a: workout.activityType,
		st: workout.startedAt,
		d: workout.durationS,
		dm: workout.distanceM ?? null,
		ah: workout.avgHr ?? null,
		mh: workout.maxHr ?? null,
		c: workout.calories ?? null,
	})}`;
}

function makeMetricExternalId(metric: {
	externalId?: string;
	source: string;
	metricType: string;
	recordedAt: string;
	value: number;
	unit?: string;
}): string {
	if (metric.externalId && metric.externalId.trim().length > 0) {
		return metric.externalId.trim();
	}
	return `met_${stableHash({
		s: metric.source,
		t: metric.metricType,
		r: metric.recordedAt,
		v: metric.value,
		u: metric.unit ?? null,
	})}`;
}

function chunk<T>(items: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

async function countExistingByExternalId(
	client: SupabaseClient,
	table: "workouts" | "health_metrics",
	userId: string,
	source: string,
	externalIds: string[],
): Promise<number> {
	if (externalIds.length === 0) return 0;
	let count = 0;

	for (const ids of chunk(externalIds, 300)) {
		const { data, error } = await client
			.from(table)
			.select("external_id")
			.eq("athlete_id", userId)
			.eq("source", source)
			.in("external_id", ids);

		if (error) {
			throw error;
		}
		count += data?.length ?? 0;
	}

	return count;
}

healthRoutes.post("/ingest", async (c) => {
	const auth = getAuth(c);
	const payload = await parseBody(c, MobileHealthIngestInput);
	if (isResponse(payload)) return payload;

	const client = createAdminClient();

	try {
		const workoutMap = new Map<
			string,
			{
				athlete_id: string;
				club_id: string;
				external_id: string;
				activity_type: string;
				source: string;
				started_at: string;
				duration_s: number;
				distance_m: number | null;
				avg_hr: number | null;
				max_hr: number | null;
				calories: number | null;
				raw_data: Record<string, unknown>;
				notes: string | null;
			}
		>();

		for (const workout of payload.workouts) {
			const externalId = makeWorkoutExternalId(workout);
			const key = `${workout.source}:${externalId}`;
			if (workoutMap.has(key)) continue;

			workoutMap.set(key, {
				athlete_id: auth.userId,
				club_id: auth.clubId,
				external_id: externalId,
				activity_type: workout.activityType,
				source: workout.source,
				started_at: workout.startedAt,
				duration_s: workout.durationS,
				distance_m: workout.distanceM ?? null,
				avg_hr: workout.avgHr ?? null,
				max_hr: workout.maxHr ?? null,
				calories: workout.calories ?? null,
				raw_data: {
					...(workout.rawData ?? {}),
					external_id: externalId,
					ingested_via: "mobile-health-sync",
				},
				notes: workout.notes ?? null,
			});
		}

		const workoutRows = [...workoutMap.values()];
		let workoutsSkipped = 0;
		for (const source of new Set(workoutRows.map((row) => row.source))) {
			const ids = workoutRows.filter((row) => row.source === source).map((row) => row.external_id);
			workoutsSkipped += await countExistingByExternalId(
				client,
				"workouts",
				auth.userId,
				source,
				ids,
			);
		}

		if (workoutRows.length > 0) {
			const { error } = await client.from("workouts").upsert(workoutRows, {
				onConflict: "athlete_id,source,external_id",
				ignoreDuplicates: true,
			});
			if (error) throw error;
		}

		const metricMap = new Map<
			string,
			{
				athlete_id: string;
				club_id: string;
				external_id: string;
				metric_type: string;
				value: number;
				unit: string | null;
				recorded_at: string;
				source: string;
				raw_data: Record<string, unknown>;
			}
		>();

		for (const metric of payload.metrics) {
			const externalId = makeMetricExternalId(metric);
			const key = `${metric.source}:${externalId}`;
			if (metricMap.has(key)) continue;

			metricMap.set(key, {
				athlete_id: auth.userId,
				club_id: auth.clubId,
				external_id: externalId,
				metric_type: metric.metricType,
				value: metric.value,
				unit: metric.unit ?? null,
				recorded_at: metric.recordedAt,
				source: metric.source,
				raw_data: {
					...(metric.rawData ?? {}),
					external_id: externalId,
					ingested_via: "mobile-health-sync",
				},
			});
		}

		const metricRows = [...metricMap.values()];
		let metricsSkipped = 0;
		for (const source of new Set(metricRows.map((row) => row.source))) {
			const ids = metricRows.filter((row) => row.source === source).map((row) => row.external_id);
			metricsSkipped += await countExistingByExternalId(
				client,
				"health_metrics",
				auth.userId,
				source,
				ids,
			);
		}

		if (metricRows.length > 0) {
			const { error } = await client.from("health_metrics").upsert(metricRows, {
				onConflict: "athlete_id,source,external_id",
				ignoreDuplicates: true,
			});
			if (error) throw error;
		}

		for (const logEntry of payload.dailyLogs) {
			const { error } = await client.from("daily_logs").upsert(
				{
					athlete_id: auth.userId,
					club_id: auth.clubId,
					log_date: logEntry.logDate,
					sleep_hours: logEntry.sleepHours ?? null,
					sleep_quality: logEntry.sleepQuality ?? null,
					rpe: logEntry.rpe ?? null,
					mood: logEntry.mood ?? null,
					hrv: logEntry.hrv ?? null,
					resting_hr: logEntry.restingHr ?? null,
					weight_kg: logEntry.weightKg ?? null,
					notes: logEntry.notes ?? null,
				},
				{ onConflict: "athlete_id,log_date" },
			);
			if (error) throw error;
		}

		const workoutsInserted = Math.max(0, workoutRows.length - workoutsSkipped);
		const metricsInserted = Math.max(0, metricRows.length - metricsSkipped);

		return c.json({
			status: "ingested",
			sourcePlatform: payload.sourcePlatform,
			syncedAt: payload.syncedAt ?? new Date().toISOString(),
			workoutsInserted,
			workoutsSkipped,
			metricsInserted,
			metricsSkipped,
			dailyLogsUpserted: payload.dailyLogs.length,
		});
	} catch (err) {
		log.error({ err, userId: auth.userId }, "Mobile health ingest failed");
		return jsonProblem(c, 500, "Internal Server Error", {
			code: "MOBILE_HEALTH_INGEST_FAILED",
			detail: "Failed to ingest mobile health payload.",
			type: "https://docs.jpx.nu/problems/mobile-health-ingest-failed",
		});
	}
});
