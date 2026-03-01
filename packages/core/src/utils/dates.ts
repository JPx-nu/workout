// ============================================================
// Date Utilities
// Pure date calculation functions used across web, mobile, and API.
// ============================================================

/** Number of days from now until a target ISO date string (min 0). */
export function daysUntil(targetDate: string): number {
	return Math.max(
		0,
		Math.ceil((new Date(targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
	);
}

/** Today's date as ISO date string (YYYY-MM-DD). */
export function toIsoDate(date: Date = new Date()): string {
	return date.toISOString().split("T")[0];
}

/** Get the Monday of the current week at 00:00:00. */
export function getWeekStart(date: Date = new Date()): Date {
	const d = new Date(date);
	const dayOfWeek = d.getDay() || 7; // Mon=1..Sun=7
	d.setDate(d.getDate() - dayOfWeek + 1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/** Compute a lookback date (ISO date string) N days ago from now. */
export function lookbackDate(days: number): string {
	return toIsoDate(new Date(Date.now() - days * 86400000));
}

/** Progress percentage (clamped 0–100). */
export function progressPercent(current: number, total: number): number {
	if (total <= 0) return 0;
	return Math.min(100, Math.round((current / total) * 100));
}
