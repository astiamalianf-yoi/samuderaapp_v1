import { Hono } from "hono";
import { redis } from "../lib/redis";
import { beachesByGroup, sendOpenClawToGroups } from "../lib/openclaw";
import { groupMessageFor } from "../lib/group-alert";
import { beachStatus } from "../lib/map-status";

const route = new Hono();

const BEACH_COORDS = [
	{ slug: "pantai_lampuuk", name: "Pantai Lampuuk", lat: 5.4487, lon: 95.2144 },
	{ slug: "pantai_lhoknga", name: "Pantai Lhoknga", lat: 5.4733, lon: 95.2167 },
	{ slug: "pantai_ulee_lheue", name: "Pantai Ulee Lheue", lat: 5.5547, lon: 95.3172 },
	{ slug: "pantai_depok", name: "Pantai Depok", lat: -7.8856, lon: 110.3319 },
	{ slug: "pantai_samas", name: "Pantai Samas", lat: -8.0283, lon: 110.3275 },
	{ slug: "pantai_pangandaran", name: "Pantai Pangandaran", lat: -7.6955, lon: 108.653 },
	{ slug: "pantai_batu_karas", name: "Pantai Batu Karas", lat: -7.7486, lon: 108.4966 },
	{ slug: "pantai_bojongsalawe", name: "Pantai Bojongsalawe", lat: -7.7033, lon: 108.5275 },
];

const MOON_PHASE: Record<string, string> = {
	"New Moon": "Bulan Baru",
	"Waxing Crescent": "Bulan Sabit Meningkat",
	"First Quarter": "Bulan Separuh",
	"Waxing Gibbous": "Bulan Cembung Meningkat",
	"Full Moon": "Bulan Purnama",
	"Waning Gibbous": "Bulan Cembung Menurun",
	"Last Quarter": "Bulan Separuh Akhir",
	"Waning Crescent": "Bulan Sabit Menurun",
};

async function fetchAstronomy(): Promise<{
	sunrise: string;
	sunset: string;
	moonPhase: string;
} | null> {
	try {
		const lats = BEACH_COORDS.map((b) => b.lat).join(",");
		const lons = BEACH_COORDS.map((b) => b.lon).join(",");

		const res = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
			`&daily=sunrise,sunset&timezone=Asia/Jakarta&forecast_days=1`,
		);

		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		const daily = data.daily as Record<string, unknown> | undefined;
		if (!daily) return null;

		const sunrise = daily.sunrise as string[] | undefined;
		const sunset = daily.sunset as string[] | undefined;

		if (!sunrise?.[0] || !sunset?.[0]) return null;

		const sunriseTime = new Date(sunrise[0]).toLocaleTimeString("id-ID", {
			hour: "2-digit",
			minute: "2-digit",
		});
		const sunsetTime = new Date(sunset[0]).toLocaleTimeString("id-ID", {
			hour: "2-digit",
			minute: "2-digit",
		});

		const today = new Date().toISOString().split("T")[0];

		const moonRes = await fetch(
			`https://api.weatherapi.com/v1/astronomy.json?key=${process.env.WEATHERAPI_KEY ?? ""}&q=-6.2,106.8&dt=${today}`,
		);

		let moonPhase = "";
		if (moonRes.ok) {
			const moonData = (await moonRes.json()) as Record<string, unknown>;
			const astro = moonData.astronomy as Record<string, unknown> | undefined;
			const astroObj = astro?.astro as Record<string, unknown> | undefined;
			const rawPhase = astroObj?.moon_phase as string | undefined;
			moonPhase = (rawPhase && MOON_PHASE[rawPhase]) ? MOON_PHASE[rawPhase] : (rawPhase ?? "Tidak diketahui");
		} else {
			moonPhase = "Tidak diketahui";
		}

		return { sunrise: sunriseTime, sunset: sunsetTime, moonPhase };
	} catch (err) {
		console.error("[broadcast-morning] Failed to fetch astronomy:", err);
		return null;
	}
}

/** A warning level in either vocabulary (fusion: waspada/siaga/ekstrem; legacy: unsafe…). */
export const isWarningLevel = (level: string) => /unsafe|waspada|siaga|ekstrem|awas/i.test(level);

type Astronomy = { sunrise: string; sunset: string; moonPhase: string } | null;

/**
 * The morning message before the fishermen go to sea (27 Nov 2026): for each group, the current
 * final card of its beach exactly as the app shows it now, in the Warning Strategy Matrix wording
 * (rows 1–19, the same text as the group warnings), with a greeting and sunrise / moon phase.
 * It reports the status; it does not count as a sent warning (no AMAN message follows from it).
 */
export async function buildMorningFor(beaches: string[], astronomy: Astronomy): Promise<string> {
	const cards = await Promise.all(beaches.map((b) => groupMessageFor(b, null, undefined, { mark: false })));
	const sections = ["\u{1F305} *SELAMAT PAGI*", "", cards.join("\n\n---\n\n")];
	if (astronomy) {
		sections.push("", "\u{1F319} *INFO LAUT*", `Matahari terbit ${astronomy.sunrise} WIB · terbenam ${astronomy.sunset} WIB`, `Fase bulan: ${astronomy.moonPhase}`);
	}
	return sections.join("\n");
}

/** Sends the morning message to every WhatsApp group (each about its own beach). */
export async function runMorningBroadcast(): Promise<{ sent: boolean; groups: number; alertsCount: number; weatherAvailable: boolean; astronomyAvailable: boolean }> {
	console.log("[broadcast-morning] Starting morning broadcast...");
	const astronomy = await fetchAstronomy();
	const groups = beachesByGroup(BEACH_COORDS.map((b) => b.slug));
	console.log("[broadcast-morning] Sending broadcast to", groups.size, "group(s)");
	let unsafeCount = 0;
	for (const [group, beaches] of groups) {
		for (const b of beaches) {
			const st = await beachStatus(b).catch(() => null);
			if (st && st.level !== "NORMAL") unsafeCount += 1;
		}
		await sendOpenClawToGroups([group], await buildMorningFor(beaches, astronomy));
	}
	return { sent: groups.size > 0, groups: groups.size, alertsCount: unsafeCount, weatherAvailable: true, astronomyAvailable: astronomy !== null };
}

/** Only with the researcher key: otherwise anyone could make the bot message every group. */
export function broadcastKeyOk(given: string | null | undefined, expected = process.env.RESEARCH_API_KEY): boolean {
	return Boolean(expected) && given === expected;
}

/** Manual trigger (testing): GET /api/broadcast/morning with header X-Research-Key. */
route.get("/broadcast/morning", async (c) => {
	if (!broadcastKeyOk(c.req.header("X-Research-Key"))) return c.json({ ok: false, error: "unauthorized" }, 401);
	try {
		return c.json({ ok: true, ...(await runMorningBroadcast()) });
	} catch (err) {
		console.error("[broadcast-morning] Failed to send:", err);
		return c.json({ ok: true, sent: false, error: "Failed to send broadcast" }, 500);
	}
});

/**
 * Daily schedule: MORNING_BROADCAST_TIME (WIB, "HH:MM", default 05:30; empty = off). Checked every
 * minute; a Redis key makes sure it is sent once per day even after a restart.
 */
export function morningDue(now: Date, time: string, lastSentDay: string | null): { due: boolean; day: string } {
	const wib = new Date(now.getTime() + 7 * 3600_000);
	const day = wib.toISOString().slice(0, 10);
	const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
	if (!m) return { due: false, day };
	const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();
	const target = Number(m[1]) * 60 + Number(m[2]);
	return { due: minutes >= target && minutes < target + 60 && lastSentDay !== day, day };
}

export function startMorningSchedule(time = process.env.MORNING_BROADCAST_TIME ?? "03:30") {
	if (!time.trim()) {
		console.log("[broadcast-morning] daily schedule off (MORNING_BROADCAST_TIME empty)");
		return;
	}
	const tick = async () => {
		try {
			const last = await redis.get("broadcast:morning:last-day");
			const { due, day } = morningDue(new Date(), time, last);
			if (!due) return;
			await redis.set("broadcast:morning:last-day", day, { EX: 3 * 86400 });
			await runMorningBroadcast();
		} catch (err) {
			console.error("[broadcast-morning] scheduled run failed:", err);
		}
	};
	setInterval(tick, 60_000);
	console.log(`[broadcast-morning] daily at ${time} WIB`);
}

export default route;
