import { Hono } from "hono";
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

export default route;
