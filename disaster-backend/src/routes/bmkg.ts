import { Hono } from "hono";
import { getBmkgData } from "../lib/bmkg-fetch";
import { getActiveNowcast } from "../lib/bmkg-nowcast";
import { listSimWarnings, SIM_ENABLED, simWarningCap, simWarningsRss } from "../lib/bmkg-sim";
import { ALLOWED_BEACH_LOCATIONS } from "../types";

const route = new Hono();

/** Active BMKG short-term warnings (peringatan dini) covering a beach. */
route.get("/bmkg/nowcast/:beach", async (c) => {
	const beach = c.req.param("beach").toLowerCase();
	if (!ALLOWED_BEACH_LOCATIONS.includes(beach as (typeof ALLOWED_BEACH_LOCATIONS)[number])) {
		return c.json({ ok: false, error: `Unknown beach: ${beach}` }, 400);
	}
	return c.json({ ok: true, data: await getActiveNowcast(beach) });
});

/** UAT test switch: simulated BMKG warnings as BMKG's own RSS + CAP formats (404 when the switch is off). */
route.get("/bmkg/sim/rss", async (c) => {
	if (!SIM_ENABLED()) return c.json({ ok: false, error: "not_found" }, 404);
	const base = `${new URL(c.req.url).protocol}//${c.req.header("host") ?? new URL(c.req.url).host}`;
	const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "");
	return c.body(simWarningsRss(await listSimWarnings(), base.replace(/^https?:/, `${proto}:`)), 200, { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" });
});

route.get("/bmkg/sim/cap/:id", async (c) => {
	if (!SIM_ENABLED()) return c.json({ ok: false, error: "not_found" }, 404);
	const w = (await listSimWarnings()).find((x) => x.id === c.req.param("id"));
	if (!w) return c.json({ ok: false, error: "not_found" }, 404);
	return c.body(simWarningCap(w), 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" });
});

route.get("/bmkg/:beach", async (c) => {
	const beach = c.req.param("beach").toLowerCase();
	if (!ALLOWED_BEACH_LOCATIONS.includes(beach as (typeof ALLOWED_BEACH_LOCATIONS)[number])) {
		return c.json({ ok: false, error: `Unknown beach: ${beach}` }, 400);
	}

	const data = await getBmkgData(beach);
	return c.json({ ok: true, data });
});

route.get("/bmkg", async (c) => {
	const allData = await Promise.all(
		ALLOWED_BEACH_LOCATIONS.map(async (beach) => {
			const data = await getBmkgData(beach);
			return data;
		}),
	);
	return c.json({ ok: true, data: allData });
});

export default route;
