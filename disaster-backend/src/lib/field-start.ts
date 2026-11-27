/**
 * Start of the field study (FIELD_START_AT, e.g. "2026-12-04T00:00:00+07:00"; agreed 26 Nov 2026).
 * Reports and incidents made before it (the practice during the socialisation on 3 Dec) stay stored
 * and appear in the research exports, but the live Trust Index and the fisherman's adaptive profile
 * do not count them. Empty or invalid: everything counts, as before.
 */
export function fieldStartMs(raw = process.env.FIELD_START_AT): number {
	if (!raw?.trim()) return 0;
	const t = Date.parse(raw.trim());
	if (!Number.isFinite(t)) {
		console.warn(`[field-start] FIELD_START_AT="${raw}" is not a date; counting every record`);
		return 0;
	}
	return t;
}

/** Keeps the records at or after the field start (all of them when no start is set). */
export function sinceFieldStart<T extends { at: number }>(rows: T[], start = fieldStartMs()): T[] {
	return start ? rows.filter((r) => r.at >= start) : rows;
}
