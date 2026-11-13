import { Hono } from "hono";
import { redis } from "../lib/redis";
import { ALERTS_STREAM } from "../config";
import { beachesByGroup, sendOpenClawToGroups } from "../lib/openclaw";
import { BEACH_DISPLAY_NAMES } from "./report";
import { currentAlerts, formatAlertsResponse, riskLabelFor } from "../lib/whatsapp-commands";

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

const WMO_WEATHER: Record<number, string> = {
	0: "Cerah", 1: "Cerah", 2: "Cerah berawan", 3: "Mendung",
	45: "Berkabut", 48: "Berkabut",
	51: "Gerimis", 53: "Gerimis", 55: "Gerimis",
	61: "Hujan", 63: "Hujan", 65: "Hujan",
	71: "Salju", 73: "Salju", 75: "Salju",
	80: "Hujan ringan", 81: "Hujan ringan", 82: "Hujan ringan",
	95: "Badai petir", 96: "Badai petir", 99: "Badai petir",
};

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

type AlertData = {
	alertId: string;
	beachLocation: string;
	riskLevel: string;
	reporterCount: number;
	firstReportAt: number;
	lastReportAt: number;
	serverTimestamp: number;
	actionRecommendation: string;
	signDescription: string;
	triggeredCodes: string[];
	communityCharacteristics: string;
	source?: string;
	bmkg?: Record<string, unknown>;
};

function formatAlert(alert: AlertData): string {
	// BMKG warnings have no reporters or natural signs: use the "!peringatan" BMKG format.
	if (alert.source === "BMKG") return formatAlertsResponse([alert], alert.beachLocation);
	const beachName = BEACH_DISPLAY_NAMES[alert.beachLocation] ?? alert.beachLocation;
	const label = riskLabelFor(alert.riskLevel);

	const dateStr = new Date(alert.serverTimestamp).toLocaleDateString("id-ID", {
		timeZone: "Asia/Jakarta",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	const startTime = new Date(alert.firstReportAt).toLocaleTimeString("id-ID", {
		timeZone: "Asia/Jakarta",
		hour: "2-digit",
		minute: "2-digit",
	});
	const endTime = new Date(alert.lastReportAt).toLocaleTimeString("id-ID", {
		timeZone: "Asia/Jakarta",
		hour: "2-digit",
		minute: "2-digit",
	});

	const signLines = alert.signDescription
		.split(" | ")
		.filter((s) => s.trim().length > 0)
		.map((s) => `- ${s.trim()}`);

	return [
		`\u26A0\uFE0F PERINGATAN \u2014 ${label} di ${beachName}`,
		dateStr,
		"",
		`\u{1F465} Dilaporkan oleh ${alert.reporterCount} nelayan`,
		`\u{1F550} Mulai: ${startTime} WIB | Berakhir: ${endTime} WIB`,
		"",
		"Tanda Alam Terdeteksi:",
		...signLines,
		"",
		"Rekomendasi Aksi:",
		alert.actionRecommendation,
	].join("\n");
}

async function fetchAlerts(): Promise<AlertData[]> {
	try {
		const events = await redis.xRange(ALERTS_STREAM, "-", "+", { COUNT: 20 });
		if (!events || events.length === 0) return [];

		const alerts = events.map((event) => {
			const fields = (event as unknown as { id: string; message: Record<string, string> }).message;
			const parsed = JSON.parse(fields.json ?? "{}") as Record<string, unknown>;
			const ml = parsed.ml as Record<string, unknown> | undefined;
			const decision = parsed.decision as Record<string, unknown> | undefined;
			const input = parsed.input as Record<string, unknown> | undefined;

			return {
				alertId: (parsed.alertId as string) ?? "",
				beachLocation: (input?.beach_location as string) ?? "",
				riskLevel: (parsed.riskLevel as string) ?? (decision?.community_characteristics === "Actionable"
					? ((decision.is_multisign as boolean) ? "unsafe-high" : "unsafe")
					: "safe"),
				reporterCount: (parsed.reporterCount as number) ?? 0,
				firstReportAt: (parsed.firstReportAt as number) ?? 0,
				lastReportAt: (parsed.lastReportAt as number) ?? 0,
				serverTimestamp: (parsed.serverTimestamp as number) ?? 0,
				actionRecommendation: (ml?.action_recommendation as string) ?? "",
				signDescription: (ml?.sign_description as string) ?? "",
				triggeredCodes: ((ml?.triggered_lik_codes as string[]) ?? (input?.lik_codes as string[]) ?? []),
				communityCharacteristics: (decision?.community_characteristics as string) ?? "",
				source: (parsed.source as string) ?? "LIK",
				bmkg: parsed.bmkg as Record<string, unknown> | undefined,
			};
		});

		// Newest first, one per alertId, no expired BMKG warning.
		return currentAlerts(alerts.reverse()).slice(0, 20);
	} catch (err) {
		console.error("[broadcast-morning] Failed to fetch alerts:", err);
		return [];
	}
}

async function fetchWeather(): Promise<{ condition: string; windSpeed: number; waveHeight: number }[] | null> {
	try {
		const lats = BEACH_COORDS.map((b) => b.lat).join(",");
		const lons = BEACH_COORDS.map((b) => b.lon).join(",");

		const [forecastRes, marineRes] = await Promise.all([
			fetch(
				`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
				`&current=weather_code,wind_speed_10m&timezone=Asia/Jakarta&forecast_days=1`,
			),
			fetch(
				`https://api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}` +
				`&current=wave_height&timezone=Asia/Jakarta&forecast_days=1`,
			),
		]);

		if (!forecastRes.ok || !marineRes.ok) return null;

		const forecast = (await forecastRes.json()) as Record<string, unknown>;
		const marine = (await marineRes.json()) as Record<string, unknown>;

		const current = forecast.current as Record<string, unknown> | undefined;
		const marineCurrent = marine.current as Record<string, unknown> | undefined;

		if (!current || !marineCurrent) return null;

		const weatherCodes = current.weather_code as number[] | number;
		const windSpeeds = current.wind_speed_10m as number[] | number;
		const waveHeights = marineCurrent.wave_height as number[] | number;

		return BEACH_COORDS.map((_, i) => ({
			condition: WMO_WEATHER[(Array.isArray(weatherCodes) ? weatherCodes[i] : weatherCodes) as number] ?? "Tidak diketahui",
			windSpeed: Math.round(Array.isArray(windSpeeds) ? windSpeeds[i] : windSpeeds),
			waveHeight: Math.round((Array.isArray(waveHeights) ? waveHeights[i] : waveHeights) * 10) / 10,
		}));
	} catch (err) {
		console.error("[broadcast-morning] Failed to fetch weather:", err);
		return null;
	}
}

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

type Weather = { condition: string; windSpeed: number; waveHeight: number }[] | null;
type Astronomy = { sunrise: string; sunset: string; moonPhase: string } | null;

/** The morning message for the beaches of one group. */
export function buildMorningMessage(beaches: string[], alerts: AlertData[], weather: Weather, astronomy: Astronomy): string {
	const sections: string[] = [];
	sections.push("\u{1F305} SELAMAT PAGI \u2014 Laporan Cuaca Laut");
	sections.push("");

	const unsafeAlerts = alerts.filter((a) => beaches.includes(a.beachLocation) && isWarningLevel(a.riskLevel));
	if (unsafeAlerts.length > 0) {
		sections.push(unsafeAlerts.map(formatAlert).join("\n\n---\n\n"));
	} else {
		const where = beaches.length === 1 ? `di ${BEACH_DISPLAY_NAMES[beaches[0]!] ?? beaches[0]}` : "di pantai Anda";
		sections.push(`\u2705 Cuaca aman ${where} hari ini.`);
		sections.push("Tetap waspada dan perhatikan tanda-tanda alam ya, Bang.");
	}

	sections.push("");
	sections.push("\u{1F324}\uFE0F CUACA HARI INI");
	if (weather) {
		BEACH_COORDS.forEach((beach, i) => {
			const w = weather[i];
			if (w && beaches.includes(beach.slug)) {
				const shortName = beach.name.replace("Pantai ", "");
				sections.push(`\u{1F4CD} ${shortName}: ${w.condition}, angin ${w.windSpeed} km/h, ombak ${w.waveHeight}m`);
			}
		});
	} else {
		sections.push("Data cuaca belum tersedia.");
	}

	if (astronomy) {
		sections.push("");
		sections.push("\u{1F319} INFO LAUT");
		sections.push(`Sunrise: ${astronomy.sunrise} WIB | Sunset: ${astronomy.sunset} WIB`);
		sections.push(`Fase bulan: ${astronomy.moonPhase}`);
	}
	return sections.join("\n");
}

/** Sends the morning message to every WhatsApp group (each about its own beach). */
export async function runMorningBroadcast(): Promise<{ sent: boolean; groups: number; alertsCount: number; weatherAvailable: boolean; astronomyAvailable: boolean }> {
	console.log("[broadcast-morning] Starting morning broadcast...");
	const [alerts, weather, astronomy] = await Promise.all([fetchAlerts(), fetchWeather(), fetchAstronomy()]);

	// One message per WhatsApp group, about that group's own beach(es) only: a neighbouring
	// beach's warning in the morning message would teach fishermen to ignore warnings.
	const groups = beachesByGroup(BEACH_COORDS.map((b) => b.slug));
	console.log("[broadcast-morning] Sending broadcast to", groups.size, "group(s)");

	let unsafeCount = 0;
	for (const [group, beaches] of groups) {
		const own = alerts.filter((a) => beaches.includes(a.beachLocation));
		unsafeCount += own.filter((a) => isWarningLevel(a.riskLevel)).length;
		await sendOpenClawToGroups([group], buildMorningMessage(beaches, own, weather, astronomy));
	}
	return { sent: groups.size > 0, groups: groups.size, alertsCount: unsafeCount, weatherAvailable: weather !== null, astronomyAvailable: astronomy !== null };
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

export function startMorningSchedule(time = process.env.MORNING_BROADCAST_TIME ?? "05:30") {
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
