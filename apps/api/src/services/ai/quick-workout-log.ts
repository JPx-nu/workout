import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "./conversation.js";
import { createLogger } from "../../lib/logger.js";
import { insertWorkout, updateWorkout } from "./supabase.js";

const log = createLogger({ module: "quick-workout-log" });

type ActivityType = "SWIM" | "BIKE" | "RUN" | "STRENGTH" | "YOGA" | "OTHER";

export interface ParsedQuickWorkoutLog {
	activityType: ActivityType;
	startedAt: string;
	durationMin?: number;
	distanceKm?: number;
	avgHr?: number;
	tss?: number;
	notes?: string;
	summary: string;
	optionalFollowUp: string | null;
}

export interface QuickWorkoutLogResponse {
	content: string;
	metadata: Record<string, unknown>;
}

interface ParsedQuickWorkoutLogFollowUp {
	avgHr?: number;
	notes?: string;
}

const WRITE_INTENT_PATTERN = /\b(log|record|save|add|track)\b/i;
const WORKOUT_CONTEXT_PATTERN =
	/\b(workout|session|training|run|ran|jog|bike|ride|rode|cycle|swim|swam|strength|lift|lifting|gym|yoga)\b/i;
const FUTURE_REFERENCE_PATTERN =
	/\b(tomorrow|next week|next month|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday)\b/i;

function hasExplicitWorkoutLogIntent(message: string): boolean {
	return WRITE_INTENT_PATTERN.test(message) && WORKOUT_CONTEXT_PATTERN.test(message);
}

function parseActivityType(message: string): ActivityType | null {
	const lower = message.toLowerCase();

	if (/\b(run|ran|jog|jogged|5k|10k|half marathon|marathon)\b/.test(lower)) return "RUN";
	if (/\b(bike|ride|rode|cycle|cycling|spin)\b/.test(lower)) return "BIKE";
	if (/\b(swim|swam|pool|open water)\b/.test(lower)) return "SWIM";
	if (/\b(strength|lift|lifting|gym|weights)\b/.test(lower)) return "STRENGTH";
	if (/\b(yoga)\b/.test(lower)) return "YOGA";

	return null;
}

function parseDurationMinutes(message: string): number | undefined {
	const lower = message.toLowerCase();

	const hourMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
	const minuteMatch =
		lower.match(/\b(\d+(?:\.\d+)?)\s*-\s*(?:minute|min)\b/) ||
		lower.match(/\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/) ||
		lower.match(/\b(\d+(?:\.\d+)?)m\b/);

	const hours = hourMatch ? Number.parseFloat(hourMatch[1]) : 0;
	const minutes = minuteMatch ? Number.parseFloat(minuteMatch[1]) : 0;
	const totalMinutes = hours * 60 + minutes;

	return totalMinutes > 0 ? totalMinutes : undefined;
}

function parseDistanceKm(message: string): number | undefined {
	const lower = message.toLowerCase();

	const kmMatch =
		lower.match(/\b(\d+(?:\.\d+)?)\s*(?:km|kilometers?|kilometres?)\b/) ||
		lower.match(/\b(\d+(?:\.\d+)?)k\b/);
	if (kmMatch) return Number.parseFloat(kmMatch[1]);

	const milesMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:mi|mile|miles)\b/);
	if (milesMatch) return Number.parseFloat(milesMatch[1]) * 1.60934;

	return undefined;
}

function parseAvgHr(message: string): number | undefined {
	const lower = message.toLowerCase();
	const avgHrMatch =
		lower.match(/\bavg(?:erage)?\s*hr\s*(?:of\s*)?(\d{2,3})\b/) ||
		lower.match(/\baverage heart rate\s*(?:of\s*)?(\d{2,3})\b/) ||
		lower.match(/\b(\d{2,3})\s*(?:bpm\s*)?(?:avg(?:erage)?\s*hr|heart rate)\b/);
	if (avgHrMatch) return Number.parseInt(avgHrMatch[1], 10);

	return undefined;
}

function parseTss(message: string): number | undefined {
	const lower = message.toLowerCase();
	const tssMatch = lower.match(/\b(\d{1,3})\s*tss\b/);
	return tssMatch ? Number.parseInt(tssMatch[1], 10) : undefined;
}

function parseNotes(message: string): string | undefined {
	const lower = message.toLowerCase();
	const match =
		lower.match(/\b(?:notes?|comment|comments?)\s*(?::|-)?\s*(.+)$/i) ||
		lower.match(/\b(?:felt|was|went)\s+(.+)$/i);

	if (!match) return undefined;

	const note = match[1].trim();
	return note.length > 0 ? note : undefined;
}

function resolveStartedAt(message: string, now: Date): string {
	const lower = message.toLowerCase();
	const startedAt = new Date(now);

	if (/\bday before yesterday\b|\btwo days ago\b/.test(lower)) {
		startedAt.setDate(startedAt.getDate() - 2);
	} else if (/\byesterday\b|last night\b/.test(lower)) {
		startedAt.setDate(startedAt.getDate() - 1);
	}

	if (/\bthis morning\b|\bmorning\b/.test(lower)) {
		startedAt.setHours(8, 0, 0, 0);
	} else if (/\bthis afternoon\b|\bafternoon\b/.test(lower)) {
		startedAt.setHours(15, 0, 0, 0);
	} else if (/\bthis evening\b|\bevening\b|\btonight\b|last night\b/.test(lower)) {
		startedAt.setHours(19, 0, 0, 0);
	}

	return startedAt.toISOString();
}

function formatDuration(durationMin?: number): string | null {
	if (!durationMin) return null;
	return `${durationMin}-minute`;
}

function formatDistance(distanceKm?: number): string | null {
	if (!distanceKm) return null;
	const rounded = Number(distanceKm.toFixed(2));
	return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(2)} km`;
}

function formatWhen(startedAt: string, now: Date): string | null {
	const workoutDate = new Date(startedAt);
	const today = new Date(now);
	const diffDays = Math.round(
		(today.setHours(0, 0, 0, 0) - workoutDate.setHours(0, 0, 0, 0)) / 86_400_000,
	);

	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	if (diffDays === 2) return "two days ago";
	return null;
}

function buildSummary(
	parsed: Omit<ParsedQuickWorkoutLog, "summary" | "optionalFollowUp">,
	now: Date,
): string {
	const distance = formatDistance(parsed.distanceKm);
	const when = formatWhen(parsed.startedAt, now);
	const core = [formatDuration(parsed.durationMin), distance, parsed.activityType.toLowerCase()]
		.filter(Boolean)
		.join(" ");
	return when ? `${core} from ${when}` : core;
}

function joinWithOr(items: string[]): string {
	if (items.length <= 1) return items[0] ?? "";
	if (items.length === 2) return `${items[0]} or ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, or ${items[items.length - 1]}`;
}

function joinWithAnd(items: string[]): string {
	if (items.length <= 1) return items[0] ?? "";
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buildOptionalFollowUp(parsed: ParsedQuickWorkoutLog): string | null {
	const missing: string[] = [];
	if (!parsed.avgHr) missing.push("average HR");
	if (!parsed.notes) missing.push("a note");

	return missing.length > 0
		? ` If you want, send ${joinWithOr(missing)} and I'll add it.`
		: null;
}

function getPendingQuickWorkoutLog(history: ChatMessage[]): {
	workoutId: string;
	activityType?: string;
} | null {
	const lastAssistantMessage = [...history].reverse().find((message) => message.role === "assistant");
	if (!lastAssistantMessage?.metadata) {
		return null;
	}

	const { metadata } = lastAssistantMessage;
	if (
		metadata.fastPath !== "quick_workout_log" ||
		metadata.awaitingOptionalDetails !== true ||
		typeof metadata.loggedWorkoutId !== "string"
	) {
		return null;
	}

	return {
		workoutId: metadata.loggedWorkoutId,
		activityType:
			typeof metadata.loggedActivityType === "string" ? metadata.loggedActivityType : undefined,
	};
}

function parseQuickWorkoutLogFollowUp(message: string): ParsedQuickWorkoutLogFollowUp | null {
	const trimmed = message.trim();
	if (!trimmed) {
		return null;
	}

	if (hasExplicitWorkoutLogIntent(trimmed) || FUTURE_REFERENCE_PATTERN.test(trimmed)) {
		return null;
	}

	if (/^(?:thanks|thank you|ok|okay|cool|nice|great|perfect)[!.]*$/i.test(trimmed)) {
		return null;
	}

	const avgHr = parseAvgHr(trimmed);
	const noteCandidate = avgHr
		? trimmed
				.replace(/\bavg(?:erage)?\s*hr\s*(?:of\s*)?\d{2,3}\b/gi, "")
				.replace(/\baverage heart rate\s*(?:of\s*)?\d{2,3}\b/gi, "")
				.replace(/\b\d{2,3}\s*(?:bpm\s*)?(?:avg(?:erage)?\s*hr|heart rate)\b/gi, "")
				.replace(/^[,\s-]+|[,\s-]+$/g, "")
				.replace(/^(?:and|with)\s+/i, "")
		: trimmed;

	const notes =
		noteCandidate.length > 0 &&
		noteCandidate.length <= 160 &&
		!WRITE_INTENT_PATTERN.test(noteCandidate)
			? noteCandidate
			: undefined;

	if (!avgHr && !notes) {
		return null;
	}

	return {
		...(avgHr ? { avgHr } : {}),
		...(notes ? { notes } : {}),
	};
}

export function parseQuickWorkoutLogRequest(
	message: string,
	options: { now?: Date } = {},
): ParsedQuickWorkoutLog | null {
	if (!hasExplicitWorkoutLogIntent(message)) {
		return null;
	}
	if (FUTURE_REFERENCE_PATTERN.test(message)) {
		return null;
	}

	const activityType = parseActivityType(message);
	if (!activityType) {
		return null;
	}

	const now = options.now ?? new Date();
	const startedAt = resolveStartedAt(message, now);
	const durationMin = parseDurationMinutes(message);
	const distanceKm = parseDistanceKm(message);
	const avgHr = parseAvgHr(message);
	const tss = parseTss(message);
	const notes = parseNotes(message);

	const parsedBase = {
		activityType,
		startedAt,
		...(durationMin ? { durationMin } : {}),
		...(distanceKm ? { distanceKm } : {}),
		...(avgHr ? { avgHr } : {}),
		...(tss ? { tss } : {}),
		...(notes ? { notes } : {}),
	};

	const summary = buildSummary(parsedBase, now);
	const parsed: ParsedQuickWorkoutLog = {
		...parsedBase,
		summary,
		optionalFollowUp: null,
	};
	parsed.optionalFollowUp = buildOptionalFollowUp(parsed);

	return parsed;
}

export async function tryHandleQuickWorkoutLog(params: {
	client: SupabaseClient;
	userId: string;
	clubId: string;
	message: string;
	now?: Date;
}): Promise<QuickWorkoutLogResponse | null> {
	const parsed = parseQuickWorkoutLogRequest(params.message, { now: params.now });
	if (!parsed) {
		return null;
	}

	try {
		const workout = await insertWorkout(params.client, {
			athlete_id: params.userId,
			club_id: params.clubId,
			activity_type: parsed.activityType,
			source: "MANUAL",
			started_at: parsed.startedAt,
			duration_s: parsed.durationMin ? parsed.durationMin * 60 : null,
			distance_m: parsed.distanceKm ? Math.round(parsed.distanceKm * 1000) : null,
			avg_hr: parsed.avgHr ?? null,
			max_hr: null,
			avg_pace_s_km: null,
			avg_power_w: null,
			calories: null,
			tss: parsed.tss ?? null,
			raw_data: null,
			notes: parsed.notes ?? null,
			embedding: undefined,
		});

		return {
			content: `Logged your ${parsed.summary}.${parsed.optionalFollowUp ?? ""}`,
			metadata: {
				model: "fast-path",
				intent: "training",
				fastPath: "quick_workout_log",
				loggedWorkoutId: workout.id,
				loggedActivityType: parsed.activityType,
				awaitingOptionalDetails: parsed.optionalFollowUp !== null,
			},
		};
	} catch (err) {
		log.warn({ err, message: params.message }, "Quick workout log failed; falling back to agent");
		return null;
	}
}

export async function tryHandleQuickWorkoutLogFollowUp(params: {
	client: SupabaseClient;
	userId: string;
	message: string;
	history: ChatMessage[];
}): Promise<QuickWorkoutLogResponse | null> {
	const pendingLog = getPendingQuickWorkoutLog(params.history);
	if (!pendingLog) {
		return null;
	}

	const parsed = parseQuickWorkoutLogFollowUp(params.message);
	if (!parsed) {
		return null;
	}

	try {
		const updatedWorkout = await updateWorkout(params.client, pendingLog.workoutId, params.userId, {
			...(parsed.avgHr ? { avg_hr: parsed.avgHr } : {}),
			...(parsed.notes ? { notes: parsed.notes } : {}),
		});

		const additions: string[] = [];
		if (parsed.avgHr) additions.push(`average HR ${parsed.avgHr}`);
		if (parsed.notes) additions.push("that note");

		const activityLabel = pendingLog.activityType?.toLowerCase() ?? updatedWorkout.activity_type.toLowerCase();

		return {
			content: `Added ${joinWithAnd(additions)} to your ${activityLabel}.`,
			metadata: {
				model: "fast-path",
				intent: "training",
				fastPath: "quick_workout_log_follow_up",
				loggedWorkoutId: updatedWorkout.id,
				loggedActivityType: updatedWorkout.activity_type,
				awaitingOptionalDetails: false,
			},
		};
	} catch (err) {
		log.warn(
			{ err, message: params.message, workoutId: pendingLog.workoutId },
			"Quick workout follow-up failed; falling back to agent",
		);
		return null;
	}
}
