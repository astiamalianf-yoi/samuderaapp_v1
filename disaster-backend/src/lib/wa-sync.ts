/**
 * One history per fisherman across the app and WhatsApp.
 *
 * - A WhatsApp message from a registered number is filed under that fisherman directly.
 * - From a number that is not registered yet, the report or incident is held under the keyed hash
 *   of the number; when he registers in the app with that number, it moves into his history with
 *   its original time (so his frequency, signs and the Trust Index count it in the right month).
 * Held items older than one year are dropped.
 */
import { asc, eq, lt } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanReports, waHeld } from "../db/schema";
import { normalizePhone, phoneHash } from "./fishermen";
import { saveIncident } from "./incident-store";

const KEEP_DAYS = 365;
const sqliteTime = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

export function holdForRegistration(rawNumber: string | null | undefined, kind: "report" | "incident", beach: string, payload: Record<string, unknown>): boolean {
	const digits = normalizePhone(rawNumber);
	if (!digits) return false;
	try {
		const db = getDb();
		db.insert(waHeld).values({ phoneHash: phoneHash(digits), kind, beach, payload }).run();
		db.delete(waHeld).where(lt(waHeld.createdAt, sqliteTime(new Date(Date.now() - KEEP_DAYS * 86_400_000)))).run();
		return true;
	} catch (err) {
		console.warn("[wa-sync] could not hold WhatsApp item:", err);
		return false;
	}
}

/** Moves everything held for this number into his history. Returns how many items moved. */
export function linkHeldWhatsApp(fishermanId: string, hash: string): { reports: number; incidents: number } {
	const db = getDb();
	const rows = db.select().from(waHeld).where(eq(waHeld.phoneHash, hash)).orderBy(asc(waHeld.createdAt), asc(waHeld.id)).all();
	let reports = 0;
	let incidents = 0;
	for (const r of rows) {
		const p = r.payload ?? {};
		if (r.kind === "report") {
			const signs = Array.isArray(p.signs) ? (p.signs as unknown[]).map(String) : [];
			if (signs.length) {
				db.insert(fishermanReports)
					.values({ fishermanId, beach: r.beach, signs, channel: "WHATSAPP", counted: p.counted !== false, createdAt: r.createdAt })
					.run();
				reports++;
			}
		} else if (r.kind === "incident" && typeof p.type === "string") {
			saveIncident({ fishermanId, beach: r.beach, type: p.type, at: new Date(`${r.createdAt.replace(" ", "T")}Z`) });
			incidents++;
		}
		db.delete(waHeld).where(eq(waHeld.id, r.id)).run();
	}
	return { reports, incidents };
}
