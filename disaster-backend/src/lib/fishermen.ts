import { linkHeldWhatsApp } from "./wa-sync";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { initDb as getDb } from "../db";
// initDb() returns the open database (and opens it on first use, e.g. in tests).
import { fishermen } from "../db/schema";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { parseAnswers, type ProfileAnswers } from "./adaptive-profile";

/**
 * Fisherman registration (decided with the researcher, 7 Nov 2026):
 * - identity = WhatsApp number, no OTP check;
 * - only a keyed hash of the number (+ last 4 digits for display) is stored;
 * - the app keeps a random token; reports from the app must carry it;
 * - a WhatsApp sender whose number is registered gets the same reporter key as his app reports.
 */

const HASH_SECRET =
	process.env.FISHERMAN_HASH_SECRET || process.env.JWT_SECRET || "samudra-dev-only-secret-change-me";
if (!process.env.FISHERMAN_HASH_SECRET && process.env.NODE_ENV === "production") {
	console.warn("[fishermen] FISHERMAN_HASH_SECRET is not set; phone hashes use a fallback secret");
}

/** "0812-3456-7890", "+62 812…", "812…", "62812…@s.whatsapp.net" -> "62812…"; null if not a phone number. */
export function normalizePhone(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = String(raw).trim();
	if (/@g\.us$/i.test(s)) return null; // WhatsApp group id, not a person
	let digits = s.split("@")[0]!.replace(/\D/g, "");
	if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
	else if (digits.startsWith("8")) digits = `62${digits}`;
	if (!/^62\d{8,13}$/.test(digits)) return null;
	return digits;
}

export const phoneHash = (digits: string) => createHmac("sha256", HASH_SECRET).update(digits).digest("hex");
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export type Fisherman = typeof fishermen.$inferSelect;

export type RegisterInput = { phone?: unknown; homeBeach?: unknown; profile?: unknown; consent?: unknown };
export type RegisterResult =
	| { ok: true; fisherman: PublicFisherman; token: string; created: boolean }
	| { ok: false; error: "invalid_phone" | "invalid_beach" | "invalid_profile" | "consent_required" };

/** `profile` = his registration answers (years, hazards, counts), never the model category. */
export type PublicFisherman = { id: string; phoneLast4: string; homeBeach: string; profile: Record<string, unknown> | null };

export const toPublic = (f: Fisherman): PublicFisherman => ({
	id: f.id,
	phoneLast4: f.phoneLast4,
	homeBeach: f.homeBeach,
	profile: f.profile ?? null,
});

const isBeach = (v: unknown): v is string => typeof v === "string" && (ALLOWED_BEACH_LOCATIONS as readonly string[]).includes(v);

/**
 * Registers a fisherman, or updates him when the number is already registered (e.g. new phone,
 * reinstalled app). A new token is issued each time; older tokens stop working.
 */
/** WhatsApp reports sent from this number before he registered join his history. */
function linkHeld(fishermanId: string, hash: string) {
	try {
		const moved = linkHeldWhatsApp(fishermanId, hash);
		if (moved.reports || moved.incidents) console.log(`[fishermen] linked earlier WhatsApp items: ${moved.reports} reports, ${moved.incidents} incidents`);
	} catch (err) {
		console.warn("[fishermen] could not link earlier WhatsApp items:", err);
	}
}

export async function registerFisherman(input: RegisterInput): Promise<RegisterResult> {
	if (input.consent !== true) return { ok: false, error: "consent_required" };
	const digits = normalizePhone(typeof input.phone === "string" ? input.phone : null);
	if (!digits) return { ok: false, error: "invalid_phone" };
	if (!isBeach(input.homeBeach)) return { ok: false, error: "invalid_beach" };
	const profile: ProfileAnswers | null = parseAnswers(input.profile);
	if (!profile) return { ok: false, error: "invalid_profile" };

	const db = getDb();
	const hash = phoneHash(digits);
	const token = randomBytes(32).toString("base64url");
	const now = new Date().toISOString();
	const existing = db.select().from(fishermen).where(eq(fishermen.phoneHash, hash)).get();

	if (existing) {
		db.update(fishermen)
			.set({ homeBeach: input.homeBeach, profile, tokenHash: tokenHash(token), consentAt: now, updatedAt: now })
			.where(eq(fishermen.id, existing.id))
			.run();
		linkHeld(existing.id, hash);
		const updated = db.select().from(fishermen).where(eq(fishermen.id, existing.id)).get()!;
		return { ok: true, fisherman: toPublic(updated), token, created: false };
	}

	const row = db
		.insert(fishermen)
		.values({
			phoneHash: hash,
			phoneLast4: digits.slice(-4),
			homeBeach: input.homeBeach,
			profile,
			tokenHash: tokenHash(token),
			consentAt: now,
		})
		.returning()
		.get();
	linkHeld(row.id, hash);
	return { ok: true, fisherman: toPublic(row), token, created: true };
}

export function findFishermanByToken(token: string | null | undefined): Fisherman | null {
	if (!token || token.length < 20) return null;
	return getDb().select().from(fishermen).where(eq(fishermen.tokenHash, tokenHash(token))).get() ?? null;
}

export function findFishermanByPhone(raw: string | null | undefined): Fisherman | null {
	const digits = normalizePhone(raw);
	if (!digits) return null;
	return getDb().select().from(fishermen).where(eq(fishermen.phoneHash, phoneHash(digits))).get() ?? null;
}

export function updateFisherman(
	f: Fisherman,
	patch: { homeBeach?: unknown; profile?: unknown },
): { ok: true; fisherman: PublicFisherman } | { ok: false; error: "invalid_beach" | "invalid_profile" } {
	const set: Partial<Fisherman> = { updatedAt: new Date().toISOString() };
	if (patch.homeBeach !== undefined) {
		if (!isBeach(patch.homeBeach)) return { ok: false, error: "invalid_beach" };
		set.homeBeach = patch.homeBeach;
	}
	if (patch.profile !== undefined) {
		const profile = parseAnswers(patch.profile);
		if (!profile) return { ok: false, error: "invalid_profile" };
		set.profile = profile;
	}
	getDb().update(fishermen).set(set).where(eq(fishermen.id, f.id)).run();
	return { ok: true, fisherman: toPublic(getDb().select().from(fishermen).where(eq(fishermen.id, f.id)).get()!) };
}

/** One reporter key for both channels: a registered fisherman is "fisher:<id>" in the app and in WhatsApp. */
export const fishermanReporterKey = (f: Fisherman) => `fisher:${f.id}`;

export function findFishermanById(id: string | null | undefined): Fisherman | null {
	if (!id) return null;
	return getDb().select().from(fishermen).where(eq(fishermen.id, id)).get() ?? null;
}
