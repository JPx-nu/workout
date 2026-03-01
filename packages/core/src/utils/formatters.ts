// ============================================================
// Fitness Display Formatters
// Pure functions for converting raw metrics to display strings.
// ============================================================

/** Convert seconds to whole minutes (rounded). */
export function secToMin(sec: number): number {
	return Math.round(sec / 60);
}

/** Convert meters to kilometers (1 decimal). */
export function mToKm(m: number): number {
	return Math.round((m / 1000) * 10) / 10;
}

/** Format duration from seconds → "1h 23m" or "45m". */
export function formatDuration(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Format pace from seconds and meters → "5:30/km". */
export function formatPace(durationSec: number, distanceM: number): string {
	if (!distanceM) return "\u2014";
	const paceSecPerKm = (durationSec / distanceM) * 1000;
	const min = Math.floor(paceSecPerKm / 60);
	const sec = Math.round(paceSecPerKm % 60);
	return `${min}:${sec.toString().padStart(2, "0")}/km`;
}
