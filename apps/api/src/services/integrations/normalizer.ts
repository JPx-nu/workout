// ============================================================
// Data Normalizer
// Maps provider-specific data → our schema, deduplicates, and
// auto-populates daily_logs from biometric metrics.
// Single pipeline shared by all providers.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "../../lib/logger.js";
import type { NormalizedMetric, NormalizedWorkout, SyncResult } from "./types.js";

const log = createLogger({ module: "normalizer" });

/** Time window for workout deduplication (ms) */
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize and store workouts + health metrics from any provider.
 * Handles deduplication and daily_log auto-population.
 */
export async function normalizeAndStore(
	workouts: NormalizedWorkout[],
	metrics: NormalizedMetric[],
	athleteId: string,
	clubId: string,
	client: SupabaseClient,
): Promise<SyncResult> {
	const result: SyncResult = {
		workoutsInserted: 0,
		workoutsSkipped: 0,
		metricsInserted: 0,
		metricsSkipped: 0,
	};

	// ── Insert workouts (dedup by athlete + source + started_at ± 5min) ──
	for (const w of workouts) {
		try {
			const windowStart = new Date(w.startedAt.getTime() - DEDUP_WINDOW_MS).toISOString();
			const windowEnd = new Date(w.startedAt.getTime() + DEDUP_WINDOW_MS).toISOString();

			const { data: existing } = await client
				.from("workouts")
				.select("id")
				.eq("athlete_id", athleteId)
				.eq("source", w.source)
				.gte("started_at", windowStart)
				.lte("started_at", windowEnd)
				.limit(1);

			if (existing?.length) {
				result.workoutsSkipped++;
				continue;
			}

			const { error } = await client.from("workouts").insert({
				athlete_id: athleteId,
				club_id: clubId,
				activity_type: w.activityType,
				source: w.source,
				started_at: w.startedAt.toISOString(),
				duration_s: w.durationS,
				distance_m: w.distanceM,
				avg_hr: w.avgHr,
				max_hr: w.maxHr,
				avg_pace_s_km: w.avgPaceSKm,
				avg_power_w: w.avgPowerW,
				calories: w.calories,
				tss: w.tss,
				raw_data: w.rawData,
				notes: w.notes,
			});

			if (error) {
				log.error({ err: error, source: w.source, athleteId }, "Workout insert error");
				result.workoutsSkipped++;
			} else {
				result.workoutsInserted++;
			}
		} catch (err) {
			log.error({ err, athleteId }, "Workout processing error");
			result.workoutsSkipped++;
		}
	}

	// ── Insert health metrics (dedup by athlete + type + recorded_at) ──
	for (const m of metrics) {
		try {
			const { data: existing } = await client
				.from("health_metrics")
				.select("id")
				.eq("athlete_id", athleteId)
				.eq("metric_type", m.metricType)
				.eq("recorded_at", m.recordedAt.toISOString())
				.limit(1);

			if (existing?.length) {
				result.metricsSkipped++;
				continue;
			}

			const { error } = await client.from("health_metrics").insert({
				athlete_id: athleteId,
				club_id: clubId,
				metric_type: m.metricType,
				value: m.value,
				unit: m.unit,
				recorded_at: m.recordedAt.toISOString(),
				source: m.source,
				raw_data: m.rawData || null,
			});

			if (error) {
				log.error({ err: error, metricType: m.metricType, athleteId }, "Metric insert error");
				result.metricsSkipped++;
			} else {
				result.metricsInserted++;
			}
		} catch (err) {
			log.error({ err, athleteId }, "Metric processing error");
			result.metricsSkipped++;
		}
	}

	// ── Auto-populate daily_logs from biometric metrics ──
	await autoPopulateDailyLogs(metrics, athleteId, clubId, client);

	return result;
}

/**
 * Auto-populate daily_logs from synced health metrics.
 * If a daily_log for today doesn't exist, creates one.
 * If it exists, updates only null fields (never overwrites manual entries).
 */
async function autoPopulateDailyLogs(
	metrics: NormalizedMetric[],
	athleteId: string,
	clubId: string,
	client: SupabaseClient,
): Promise<void> {
	// Group metrics by date
	const byDate = new Map<string, { hrv?: number; restingHr?: number; sleepHours?: number }>();

	for (const m of metrics) {
		const date = m.recordedAt.toISOString().split("T")[0];
		const existing = byDate.get(date) || {};

		switch (m.metricType) {
			case "HRV":
				existing.hrv = m.value;
				break;
			case "RESTING_HR":
				existing.restingHr = m.value;
				break;
			case "SLEEP_HOURS":
				existing.sleepHours = m.value;
				break;
		}

		byDate.set(date, existing);
	}

	// Upsert daily_logs
	for (const [date, data] of byDate) {
		const { data: existing } = await client
			.from("daily_logs")
			.select("id, hrv, resting_hr, sleep_hours")
			.eq("athlete_id", athleteId)
			.eq("log_date", date)
			.single();

		if (existing) {
			// Update only null fields (don't overwrite manual entries)
			const updates: Record<string, unknown> = {};
			if (existing.hrv === null && data.hrv !== undefined) updates.hrv = data.hrv;
			if (existing.resting_hr === null && data.restingHr !== undefined)
				updates.resting_hr = data.restingHr;
			if (existing.sleep_hours === null && data.sleepHours !== undefined)
				updates.sleep_hours = data.sleepHours;

			if (Object.keys(updates).length > 0) {
				await client.from("daily_logs").update(updates).eq("id", existing.id);
			}
		} else {
			// Create new daily_log
			await client.from("daily_logs").insert({
				athlete_id: athleteId,
				club_id: clubId,
				log_date: date,
				hrv: data.hrv || null,
				resting_hr: data.restingHr || null,
				sleep_hours: data.sleepHours || null,
			});
		}
	}
}
