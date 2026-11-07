import { Hono } from "hono";
import { ALLOWED_BEACH_LOCATIONS } from "../types";
import { getBmkgData } from "../lib/bmkg-fetch";
import { BEACH_AREA, capAppliesToBeach, parseCap, triggerNowcastCheck } from "../lib/bmkg-nowcast";
import { addSimWarning, clearSims, getSimWeather, listSimWarnings, setSimWeather, SIM_ENABLED, simWarningCap } from "../lib/bmkg-sim";
import { desc } from "drizzle-orm";
import { initDb as getDb } from "../db";
import { fishermanClassHistory, fishermanReports, fishermen, incidents } from "../db/schema";
import { answersOf, effectiveProfile, loadActivity } from "../lib/adaptive-profile";

/**
 * Researcher-only data (the fisherman never sees his category). Enabled only when
 * RESEARCH_API_KEY is set; every call needs the header X-Research-Key.
 */
const route = new Hono();

route.use("/research/*", async (c, next) => {
	const key = process.env.RESEARCH_API_KEY;
	if (!key) return c.json({ ok: false, error: "not_found" }, 404);
	if (c.req.header("X-Research-Key") !== key) return c.json({ ok: false, error: "forbidden" }, 403);
	await next();
});

const csv = (rows: Record<string, unknown>[]) => {
	if (!rows.length) return "";
	const cols = Object.keys(rows[0]!);
	const cell = (v: unknown) => {
		const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
		return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return [cols.join(","), ...rows.map((r) => cols.map((k) => cell(r[k])).join(","))].join("\n");
};
const sendCsv = (name: string, rows: Record<string, unknown>[]) =>
	new Response(csv(rows), {
		headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
	});

/** GET /api/research/fishermen: each fisherman, his adaptive profile now and his latest category. */
route.get("/research/fishermen", (c) => {
	const db = getDb();
	const history = db.select().from(fishermanClassHistory).orderBy(desc(fishermanClassHistory.id)).all();
	const latest = new Map<string, (typeof history)[number]>();
	for (const h of history) if (!latest.has(h.fishermanId)) latest.set(h.fishermanId, h);
	const rows = db.select().from(fishermen).all().map((f) => {
		const answers = answersOf(f.profile);
		const activity = loadActivity(f.id);
		const last = latest.get(f.id);
		return {
			id: f.id,
			phoneLast4: f.phoneLast4,
			homeBeach: f.homeBeach,
			registeredAt: f.createdAt,
			activity,
			effectiveProfile: answers ? effectiveProfile(answers, activity) : null,
			behaviouralClass: last?.behaviouralClass ?? null,
			meanProbability: last?.meanProbability ?? null,
			classSource: last?.source ?? null,
			classUpdatedAt: last?.createdAt ?? null,
			historyRows: history.filter((h) => h.fishermanId === f.id).length,
		};
	});
	return c.json({ ok: true, fishermen: rows });
});

route.get("/research/class-history.csv", () =>
	sendCsv("class-history.csv", getDb().select().from(fishermanClassHistory).all() as unknown as Record<string, unknown>[]));
route.get("/research/fisherman-reports.csv", () =>
	sendCsv("fisherman-reports.csv", getDb().select().from(fishermanReports).all() as unknown as Record<string, unknown>[]));
route.get("/research/incidents.csv", () =>
	sendCsv("incidents.csv", getDb().select().from(incidents).all() as unknown as Record<string, unknown>[]));

/**
 * UAT test switch (BMKG_SIM_ENABLED=true and X-Research-Key):
 *   POST   /api/research/uat/bmkg          { beach, windSpeed?, forecast?: clear|cloudy|rain, unavailable?, minutes? }
 *   POST   /api/research/uat/bmkg/warning  { areaDesc?, polygon?, event?, headline?, description?, minutes? }
 *   GET    /api/research/uat/bmkg          what is simulated now
 *   DELETE /api/research/uat/bmkg          end every simulation
 * Everything expires after at most 60 minutes.
 */
route.use("/research/uat/*", async (c, next) => {
	if (!SIM_ENABLED()) return c.json({ ok: false, error: "test switch off (BMKG_SIM_ENABLED is not true)" }, 404);
	await next();
});

route.post("/research/uat/bmkg", async (c) => {
	const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	const beach = String(b.beach ?? "");
	if (!(ALLOWED_BEACH_LOCATIONS as readonly string[]).includes(beach)) return c.json({ ok: false, error: "unknown beach" }, 400);
	const forecast = ["clear", "cloudy", "rain"].includes(String(b.forecast)) ? (b.forecast as "clear" | "cloudy" | "rain") : undefined;
	const windSpeed = b.windSpeed === undefined ? undefined : Number(b.windSpeed);
	if (windSpeed !== undefined && !(windSpeed >= 0 && windSpeed < 300)) return c.json({ ok: false, error: "windSpeed must be 0-300 km/h" }, 400);
	const sim = await setSimWeather(beach, { windSpeed, forecast, unavailable: b.unavailable === true }, Number(b.minutes) || undefined);
	return c.json({ ok: true, beach, sim, bmkg: await getBmkgData(beach) });
});

route.post("/research/uat/bmkg/warning", async (c) => {
	const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
	if (!b.areaDesc && !b.polygon) return c.json({ ok: false, error: "give areaDesc and/or polygon" }, 400);
	const w = await addSimWarning({
		areaDesc: b.areaDesc as string | undefined, polygon: b.polygon as string | undefined, event: b.event as string | undefined,
		headline: b.headline as string | undefined, description: b.description as string | undefined, minutes: Number(b.minutes) || undefined,
	});
	const cap = parseCap(simWarningCap(w))!;
	const beaches = Object.keys(BEACH_AREA).filter((beach) => capAppliesToBeach(beach, cap));
	const sent = await triggerNowcastCheck();
	return c.json({ ok: true, warning: w, coversBeaches: beaches, broadcast: sent });
});

route.get("/research/uat/bmkg", async (c) => {
	const weather: Record<string, unknown> = {};
	for (const beach of ALLOWED_BEACH_LOCATIONS) {
		const s = await getSimWeather(beach);
		if (s) weather[beach] = s;
	}
	return c.json({ ok: true, weather, warnings: await listSimWarnings() });
});

route.delete("/research/uat/bmkg", async (c) => {
	await clearSims([...ALLOWED_BEACH_LOCATIONS]);
	await triggerNowcastCheck();
	return c.json({ ok: true, cleared: true });
});

export default route;

