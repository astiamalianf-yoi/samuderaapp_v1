import { and, eq, gte, lte } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports, incidents } from "../db/schema";
import { CONFIRM_WINDOW_MS } from "./trust-index";

const sqliteTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

/**
 * Codebook No. 12 counts hazards "detected using LIK". It is read from his own reports (app or
 * WhatsApp): he reported a natural sign at the same beach within the confirmation window before.
 */
export function reportedSignBefore(fishermanId: string, beach: string, at = new Date()): boolean {
	const row = getDb()
		.select({ id: fishermanReports.id })
		.from(fishermanReports)
		.where(and(
			eq(fishermanReports.fishermanId, fishermanId),
			eq(fishermanReports.beach, beach),
			gte(fishermanReports.createdAt, sqliteTime(new Date(at.getTime() - CONFIRM_WINDOW_MS))),
			lte(fishermanReports.createdAt, sqliteTime(at)),
		))
		.get();
	return Boolean(row);
}

/** One incident, from the app or from WhatsApp (!kejadian), in the same table. */
export function saveIncident(o: {
	fishermanId: string; beach: string; type: string; needHelp?: boolean;
	lat?: number | null; lon?: number | null; at?: Date; channel?: string;
}) {
	const at = o.at ?? new Date();
	return getDb()
		.insert(incidents)
		.values({
			fishermanId: o.fishermanId,
			beach: o.beach,
			type: o.type,
			needHelp: o.needHelp === true,
			detectedBySign: reportedSignBefore(o.fishermanId, o.beach, at),
			latitude: o.lat ?? null,
			longitude: o.lon ?? null,
			...(o.at ? { createdAt: sqliteTime(at) } : {}),
		})
		.returning()
		.get();
}
