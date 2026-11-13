/**
 * BMKG short-term weather warnings (peringatan dini / nowcast, CAP format).
 *
 * The public forecast API (bmkg-fetch.ts) only gives a 3-hourly village forecast.
 * Severe-weather warnings are a separate BMKG product: an RSS list of CAP files,
 * each naming the affected districts and carrying area polygons. This module
 * matches those warnings to our beaches, keeps the active ones in Redis (read by
 * the fusion in reassurance.ts), and broadcasts each new warning once to the
 * WhatsApp group, push subscribers, SSE/WS clients and the IoT buzzer.
 */
import { listSimWarnings, simWarningCap } from "./bmkg-sim";
import { beachesByGroup } from "./openclaw";
import { createHash } from "node:crypto";
import { redis } from "./redis";
import { getActiveWarning, syncActiveWarningWithBmkg } from "./crowdsource";
import {
	ALERTS_CHANNEL,
	ALERTS_STREAM,
	BMKG_NOWCAST_ENABLED,
	BMKG_NOWCAST_INTERVAL_MINUTES,
	BMKG_NOWCAST_RSS_URL,
} from "../config";

export type NowcastWarning = {
	id: string;
	event: string;
	headline: string;
	description: string;
	effective: number | null;
	expires: number | null;
};

/** Beach location and the district names BMKG would use for it. */
/**
 * `province`: when set, a name match also needs the province in the warning text, for kecamatan
 * names that exist elsewhere too (e.g. Parigi is also in Parigi Moutong, Central Sulawesi).
 * Coordinates of the West Java beaches are approximate (beach front, ±1 km).
 */
export const BEACH_AREA: Record<string, { lat: number; lon: number; names: string[]; label: string; province?: string }> = {
	pantai_lampuuk: { lat: 5.4833, lon: 95.2333, names: ["Lhoknga", "Aceh Besar"], label: "Pantai Lampuuk" },
	pantai_lhoknga: { lat: 5.4667, lon: 95.2333, names: ["Lhoknga", "Aceh Besar"], label: "Pantai Lhoknga" },
	pantai_ulee_lheue: { lat: 5.5583, lon: 95.3083, names: ["Meuraxa", "Banda Aceh"], label: "Pantai Ulee Lheue" },
	pantai_depok: { lat: -8.0167, lon: 110.3167, names: ["Kretek", "Bantul"], label: "Pantai Depok" },
	pantai_samas: { lat: -8.025, lon: 110.3, names: ["Sanden", "Bantul"], label: "Pantai Samas" },
	pantai_pangandaran: { lat: -7.6955, lon: 108.653, names: ["Pangandaran"], label: "Pantai Pangandaran", province: "Jawa Barat" },
	pantai_batu_karas: { lat: -7.7486, lon: 108.4966, names: ["Cijulang", "Pangandaran"], label: "Pantai Batu Karas", province: "Jawa Barat" },
	pantai_bojongsalawe: { lat: -7.7033, lon: 108.5275, names: ["Parigi", "Pangandaran"], label: "Pantai Bojongsalawe", province: "Jawa Barat" },
};

/** RSS titles name the province; only CAP files for our two provinces are downloaded. */
const PROVINCE_KEYWORDS = ["aceh", "yogyakarta", "diy", "jawa barat"];

const ACTIVE_KEY = (beach: string) => `bmkg:nowcast:active:${beach}`;
const SENT_KEY = (id: string, beach: string) => `bmkg:nowcast:sent:${id}:${beach}`;
/** What was last broadcast to a beach (event, end time, level), to skip BMKG re-issues that change nothing. */
const LAST_KEY = (beach: string) => `bmkg:nowcast:last:${beach}`;
/** A warning that ends within this many minutes is not broadcast any more. */
export const MIN_REMAINING_MINUTES = 15;
/** An end time this much later than the one already broadcast counts as an extension. */
const EXTENSION_MINUTES = 10;

// ---------------------------------------------------------------------------
// Parsing (pure; Bun has no DOMParser, CAP/RSS are simple enough for regex)
// ---------------------------------------------------------------------------

const decode = (s: string) =>
	s
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.trim();

function tagAll(xml: string, tag: string): string[] {
	const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "gi");
	return [...xml.matchAll(re)].map((m) => decode(m[1] ?? ""));
}

const tag = (xml: string, name: string) => tagAll(xml, name)[0] ?? "";

export function parseRssItems(xml: string): { title: string; link: string }[] {
	return tagAll(xml, "item")
		.map((item) => ({ title: tag(item, "title"), link: tag(item, "link") }))
		.filter((i) => i.link);
}

export type CapInfo = NowcastWarning & { polygons: string[]; areaDescs: string[] };

export function parseCap(xml: string): CapInfo | null {
	// A CAP file can carry one <info> per language; the first one is Indonesian.
	const info = tagAll(xml, "info")[0];
	if (!info) return null;
	const parseTime = (s: string) => {
		const t = Date.parse(s);
		return Number.isFinite(t) ? t : null;
	};
	const identifier = tag(xml, "identifier");
	const headline = tag(info, "headline");
	const effective = parseTime(tag(info, "effective"));
	return {
		id: identifier || createHash("sha1").update(`${headline}|${effective}`).digest("hex").slice(0, 16),
		event: tag(info, "event") || "Peringatan cuaca",
		headline,
		description: tag(info, "description"),
		effective,
		expires: parseTime(tag(info, "expires")),
		polygons: tagAll(info, "polygon"),
		areaDescs: tagAll(info, "areaDesc"),
	};
}

export function pointInPolygon(lat: number, lon: number, poly: [number, number][]): boolean {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const [yi, xi] = poly[i]!;
		const [yj, xj] = poly[j]!;
		if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
	}
	return inside;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * True when a CAP polygon contains the beach, or the warning names the beach's
 * kecamatan or kabupaten/kota. A province name alone ("Aceh") does not count.
 */
export function capAppliesToBeach(beach: string, cap: Pick<CapInfo, "polygons" | "areaDescs" | "description" | "headline">): boolean {
	const area = BEACH_AREA[beach];
	if (!area) return false;
	for (const text of cap.polygons) {
		const poly = text
			.trim()
			.split(/\s+/)
			.map((p) => p.split(",").map(Number) as [number, number])
			.filter((p) => p.length === 2 && p.every(Number.isFinite));
		if (poly.length >= 3 && pointInPolygon(area.lat, area.lon, poly)) return true;
	}
	const text = [...cap.areaDescs, cap.description, cap.headline].join(" ").toLowerCase().replace(/\s+/g, " ");
	if (area.province && !text.includes(area.province.toLowerCase())) return false;
	return area.names.some((n) => new RegExp(`(^|[^a-z])${escapeRe(n.toLowerCase())}([^a-z]|$)`).test(text));
}

// ---------------------------------------------------------------------------
// Fetching and state
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "SamudraEWS/1.0", Accept: "application/xml,text/xml,*/*" },
			signal: AbortSignal.timeout(15000),
		});
		return res.ok ? await res.text() : null;
	} catch {
		return null;
	}
}

/** Active warnings per beach, straight from BMKG. */
/**
 * BMKG warnings per beach. `incomplete` is set when BMKG's feed or one of its warnings could not be
 * read: the check then must not treat a missing warning as ended (no shortening, no clearing).
 */
export type NowcastByBeach = Record<string, CapInfo[]> & { incomplete?: boolean };

export async function fetchNowcastByBeach(now = Date.now()): Promise<NowcastByBeach> {
	const out: NowcastByBeach = Object.fromEntries(Object.keys(BEACH_AREA).map((b) => [b, []]));
	// UAT test switch: simulated warnings go through the same CAP parsing and beach matching.
	for (const w of await listSimWarnings(now)) {
		const cap = parseCap(simWarningCap(w));
		if (!cap) continue;
		for (const beach of Object.keys(BEACH_AREA)) {
			if (capAppliesToBeach(beach, cap)) out[beach]!.push(cap);
		}
	}
	const rss = await fetchText(BMKG_NOWCAST_RSS_URL);
	if (!rss) {
		Object.defineProperty(out, "incomplete", { value: true, enumerable: false });
		return out;
	}
	const items = parseRssItems(rss).filter((i) => PROVINCE_KEYWORDS.some((k) => i.title.toLowerCase().includes(k)));
	for (const item of items.slice(0, 15)) {
		const xml = await fetchText(item.link);
		const cap = xml ? parseCap(xml) : null;
		if (!xml) Object.defineProperty(out, "incomplete", { value: true, enumerable: false, configurable: true });
		if (!cap || (cap.expires !== null && cap.expires <= now)) continue;
		for (const beach of Object.keys(BEACH_AREA)) {
			if (capAppliesToBeach(beach, cap)) out[beach]!.push(cap);
		}
	}
	return out;
}

/** Active BMKG warnings for a beach, as last stored by the monitor (no network call). */
export async function getActiveNowcast(beach: string, now = Date.now()): Promise<NowcastWarning[]> {
	try {
		const raw = await redis.get(ACTIVE_KEY(beach));
		if (!raw) return [];
		return (JSON.parse(raw) as NowcastWarning[]).filter((w) => w.expires === null || w.expires > now);
	} catch {
		return [];
	}
}

const timeWib = (ms: number | null) =>
	ms === null
		? "-"
		: new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(ms) + " WIB";

/**
 * The first sentence of the BMKG text without its long list of kecamatan (BMKG lists every
 * kecamatan of the province alphabetically, cut off long before the beach's own), followed by
 * the kabupaten/kota of these beaches, e.g. "... di sebagian wilayah Aceh, termasuk Aceh Besar."
 * The kabupaten, not the kecamatan: Lampuuk lies in kecamatan Lhoknga, and "Lhoknga" in the
 * Lampuuk group would read as the neighbouring beach.
 */
export function shortNowcastDescription(description: string, beaches: string[]): string {
	const head = description.split(/,?\s*khususnya\b/i)[0]!.trim().replace(/[.,;\s]+$/, "");
	const areas = [...new Set(beaches.map((b) => {
		const names = BEACH_AREA[b]?.names ?? [];
		return names[names.length - 1] ?? "";
	}).filter(Boolean))];
	const base = head.length > 220 ? `${head.slice(0, 217)}...` : head;
	if (!base) return areas.length ? `Termasuk wilayah ${areas.join(" dan ")}.` : "";
	return areas.length ? `${base}, termasuk ${areas.join(" dan ")}.` : `${base}.`;
}

export function formatNowcastWhatsApp(w: NowcastWarning, beaches: string[], escalated: string[] = [], extended = false): string {
	const label = (b: string) => BEACH_AREA[b]?.label ?? b;
	const names = beaches.map(label).join(", ");
	const esc = beaches.filter((b) => escalated.includes(b));
	const allEsc = esc.length > 0 && esc.length === beaches.length;
	return [
		allEsc ? `🔴 *PERINGATAN BMKG — BAHAYA*` : `⚠️ *PERINGATAN BMKG — SIAGA*`,
		`📍 ${names}`,
		`🌩️ ${w.event}`,
		extended ? `🔄 *Diperpanjang* sampai ${timeWib(w.expires)}` : `🕒 Berlaku sampai ${timeWib(w.expires)}`,
		...(esc.length ? [`🔴 *BAHAYA* di ${esc.map(label).join(", ")}: nelayan juga melaporkan tanda alam bahaya.`] : []),
		"",
		shortNowcastDescription(w.description, beaches),
		"",
		esc.length
			? `👉 *Jangan melaut sampai peringatan berakhir.* Jika sudah di laut, segera menepi.`
			: `👉 *Tunda melaut sampai peringatan berakhir.* Jika sudah di laut, segera menepi.`,
		`Sumber: BMKG (peringatan dini cuaca)${esc.length ? " dan laporan nelayan" : ""}`,
	].join("\n");
}

type LastSent = { event: string; expires: number | null; level: string };

/**
 * Whether a warning is news for a beach compared with what was last broadcast there:
 * "new" (another event, or the earlier one has ended), "extended" (same event, later end time),
 * "escalated" (same event, now BAHAYA), or null (a re-issue that changes nothing, or a
 * warning that ends within MIN_REMAINING_MINUTES).
 */
export function nowcastNews(
	w: Pick<NowcastWarning, "event" | "expires">,
	level: string,
	last: LastSent | null,
	now = Date.now(),
): "new" | "extended" | "escalated" | null {
	if (w.expires !== null && w.expires - now < MIN_REMAINING_MINUTES * 60_000) return null;
	const lastActive = last && (last.expires === null || last.expires > now);
	if (!last || !lastActive || last.event.toLowerCase() !== w.event.toLowerCase()) return "new";
	if (level === "EKSTREM" && last.level !== "EKSTREM") return "escalated";
	if (w.expires !== null && last.expires !== null && w.expires > last.expires + EXTENSION_MINUTES * 60_000) return "extended";
	return null;
}

/**
 * One alert event per beach. When the fishermen of that beach already have an active
 * warning at SIAGA (LIK side), both sources point to danger and the event is BAHAYA (EKSTREM),
 * the same rule as reassurance.ts fuseLevels.
 */
export function buildNowcastAlertEvent(w: NowcastWarning, beach: string, now = Date.now(), likLevel: string | null = null) {
	const bahaya = String(likLevel ?? "").toUpperCase() === "SIAGA" || String(likLevel ?? "").toUpperCase() === "EKSTREM";
	const action = bahaya
		? `BAHAYA: BMKG mengeluarkan peringatan (${w.event}) sampai ${timeWib(w.expires)} dan nelayan juga melaporkan tanda alam bahaya. Jangan melaut.`
		: `Peringatan BMKG: ${w.event} sampai ${timeWib(w.expires)}. Tunda melaut sampai peringatan berakhir.`;
	return {
		alertId: `bmkg-${createHash("sha1").update(`${w.id}|${beach}`).digest("hex").slice(0, 20)}`,
		source: "BMKG",
		beachLocation: beach,
		riskLevel: bahaya ? "ekstrem" : "siaga",
		serverTimestamp: now,
		reporterCount: 0,
		decision: { is_actionable: true, shouldDistribute: true, final_risk_level: bahaya ? "EKSTREM" : "SIAGA", community_characteristics: "Actionable" },
		reassurance: { shapRisk: likLevel ? String(likLevel).toUpperCase() : "NORMAL", bmkgRisk: "HIGH", agreed: bahaya, finalLevel: bahaya ? "EKSTREM" : "SIAGA" },
		ml: { action_recommendation: action, active_warning: [], triggered_lik_codes: [], sign_description: w.event },
		input: { lik_codes: [], beach_location: beach },
		bmkg: { id: w.id, event: w.event, headline: w.headline, effective: w.effective, expires: w.expires },
	};
}

type Deps = {
	fetchByBeach?: (now: number) => Promise<NowcastByBeach>;
	/** Sends one message to one WhatsApp group. */
	sendWhatsApp?: (group: string, text: string) => Promise<void>;
	/** Group -> the beaches it covers (default: OPENCLAW_BEACH_GROUPS / OPENCLAW_BROADCAST_GROUPS). */
	groupsFor?: (beaches: string[]) => Map<string, string[]>;
	publishIot?: (event: unknown) => Promise<unknown>;
	/** LIK level of the active fishermen's warning at a beach (default: the stored active warning). */
	likLevelFor?: (beach: string) => Promise<string | null>;
	/** Sets the active fishermen's warning end from BMKG's end, or null when BMKG has none (default: crowdsource). */
	syncLik?: (beach: string, bmkgEndMs: number | null, now: number) => Promise<unknown>;
};

async function storedLikLevel(beach: string): Promise<string | null> {
	const active = await getActiveWarning(beach).catch(() => null);
	const ev = active?.alertEvent as { ml?: { lik_risk_level?: string } } | undefined;
	return ev?.ml?.lik_risk_level ?? null;
}

/**
 * One monitor pass: store active warnings per beach, then broadcast each warning that is news
 * for that beach (nowcastNews): a new event, a later end time, or BAHAYA. BMKG re-issues an
 * ongoing warning about hourly with a new identifier; a re-issue that changes nothing, or a
 * warning ending within MIN_REMAINING_MINUTES, is not sent again. One WhatsApp message per
 * warning (listing its beaches); one alert event per beach for push/SSE/WS/IoT.
 */
export async function runNowcastCheck(deps: Deps = {}, now = Date.now()) {
	const byBeach = await (deps.fetchByBeach ?? fetchNowcastByBeach)(now);
	const fresh = new Map<string, { warning: NowcastWarning; beaches: string[]; extended: string[] }>();

	for (const [beach, caps] of Object.entries(byBeach)) {
		const warnings: NowcastWarning[] = caps.map(({ id, event, headline, description, effective, expires }) => ({
			id, event, headline, description, effective, expires,
		}));
		const latestExpiry = Math.max(now + 60_000, ...warnings.map((w) => w.expires ?? now + 3 * 3600_000));
		if (warnings.length) {
			await redis.set(ACTIVE_KEY(beach), JSON.stringify(warnings), { EX: Math.ceil((latestExpiry - now) / 1000) });
		} else if (!byBeach.incomplete) {
			await redis.del(ACTIVE_KEY(beach));
		}
		// A fishermen's warning active at this beach follows BMKG: until BMKG's end while BMKG warns,
		// back to its own hour when BMKG ends or is withdrawn early (14 Nov 2026). When BMKG could not
		// be read, a missing warning is not taken as ended.
		if (warnings.length || !byBeach.incomplete) {
			await (deps.syncLik ?? syncActiveWarningWithBmkg)(beach, warnings.length ? latestExpiry : null, now).catch(() => null);
		}

		const likFor = deps.likLevelFor ?? storedLikLevel;
		let last: LastSent | null = null;
		try {
			const raw = await redis.get(LAST_KEY(beach));
			last = raw ? (JSON.parse(raw) as LastSent) : null;
		} catch {
			last = null;
		}
		// Latest end time first, so a re-issue that extends the warning is the one compared.
		for (const w of [...warnings].sort((a, b) => (b.expires ?? Infinity) - (a.expires ?? Infinity))) {
			const ttl = Math.max(60, Math.ceil(((w.expires ?? now + 6 * 3600_000) - now) / 1000) + 3600);
			const firstTime = await redis.set(SENT_KEY(w.id, beach), "1", { NX: true, EX: ttl });
			if (firstTime !== "OK") continue;
			const lik = await likFor(beach).catch(() => null);
			const level = buildNowcastAlertEvent(w, beach, now, lik).decision.final_risk_level;
			const news = nowcastNews(w, level, last, now);
			if (!news) continue; // BMKG re-issued the same warning, or it is about to end
			last = { event: w.event, expires: w.expires, level };
			await redis.set(LAST_KEY(beach), JSON.stringify(last), { EX: ttl });
			const entry = fresh.get(w.id) ?? { warning: w, beaches: [], extended: [] };
			entry.beaches.push(beach);
			if (news === "extended") entry.extended.push(beach);
			fresh.set(w.id, entry);
		}
	}

	let events = 0;
	const likFor = deps.likLevelFor ?? storedLikLevel;
	for (const { warning, beaches, extended } of fresh.values()) {
		const escalated: string[] = [];
		for (const beach of beaches) {
			const lik = await likFor(beach).catch(() => null);
			const event = buildNowcastAlertEvent(warning, beach, now, lik);
			if (event.riskLevel === "ekstrem") escalated.push(beach);
			const json = JSON.stringify(event);
			await redis.xAdd(ALERTS_STREAM, "*", { json });
			await redis.publish(ALERTS_CHANNEL, json);
			await deps.publishIot?.(event).catch(() => undefined);
			events += 1;
		}
		// Each beach group gets the warning only if it covers its beach, naming only its beaches.
		for (const [group, own] of (deps.groupsFor ?? beachesByGroup)(beaches)) {
			const isExtension = own.every((b) => extended.includes(b));
			await deps.sendWhatsApp?.(group, formatNowcastWhatsApp(warning, own, escalated, isExtension)).catch(() => undefined);
		}
	}
	return { warnings: fresh.size, events };
}

let timer: ReturnType<typeof setInterval> | null = null;

let monitorDeps: Deps | null = null;

/** Runs one monitor pass now (used by the UAT test switch so a simulated warning is sent at once). */
export async function triggerNowcastCheck() {
	return runNowcastCheck(monitorDeps ?? {});
}

export function startNowcastMonitor(deps: Deps) {
	monitorDeps = deps;
	if (!BMKG_NOWCAST_ENABLED || timer) return;
	const run = () =>
		runNowcastCheck(deps)
			.then((r) => r.warnings && console.log("[bmkg-nowcast] broadcast", r))
			.catch((err) => console.error("[bmkg-nowcast] check failed", err instanceof Error ? err.message : err));
	setTimeout(run, 5_000);
	timer = setInterval(run, BMKG_NOWCAST_INTERVAL_MINUTES * 60_000);
}
