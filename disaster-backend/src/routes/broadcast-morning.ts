import { Hono } from "hono";
import { redis } from "../lib/redis";
import { ALERTS_STREAM } from "../config";
import { sendOpenClawAlert } from "../lib/openclaw";
import { BEACH_DISPLAY_NAMES } from "./report";
import { riskLabelFor } from "../lib/whatsapp-commands";

const route = new Hono();

const BEACH_COORDS = [
	{ slug: "pantai_lampuuk", name: "Pantai Lampuuk", lat: 5.4487, lon: 95.2144 },
	{ slug: "pantai_lhoknga", name: "Pantai Lhoknga", lat: 5.4733, lon: 95.2167 },
	{ slug: "pantai_ulee_lheue", name: "Pantai Ulee Lheue", lat: 5.5547, lon: 95.3172 },
	{ slug: "pantai_depok", name: "Pantai Depok", lat: -7.8856, lon: 110.3319 },
	{ slug: "pantai_samas", name: "Pantai Samas", lat: -8.0283, lon: 110.3275 },
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
};

function formatAlert(alert: AlertData): string {
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
			};
		});

		return alerts.reverse().slice(0, 20);
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

route.get("/broadcast/morning", async (c) => {
	console.log("[broadcast-morning] Starting morning broadcast...");

	const [alerts, weather, astronomy] = await Promise.all([
		fetchAlerts(),
		fetchWeather(),
		fetchAstronomy(),
	]);

	const sections: string[] = [];

	sections.push("\u{1F305} SELAMAT PAGI \u2014 Laporan Cuaca Laut");
	sections.push("");

	const unsafeAlerts = alerts.filter((a) => {
		const lower = a.riskLevel.toLowerCase();
		return lower.includes("unsafe");
	});

	if (unsafeAlerts.length > 0) {
		sections.push(unsafeAlerts.map(formatAlert).join("\n\n---\n\n"));
	} else {
		sections.push("\u2705 Cuaca aman di semua pantai hari ini.");
		sections.push("Tetap waspada dan perhatikan tanda-tanda alam ya, Bang.");
	}

	if (weather) {
		sections.push("");
		sections.push("\u{1F324}\uFE0F CUACA HARI INI");
		BEACH_COORDS.forEach((beach, i) => {
			const w = weather[i];
			if (w) {
				const shortName = beach.name.replace("Pantai ", "");
				sections.push(`\u{1F4CD} ${shortName}: ${w.condition}, angin ${w.windSpeed} km/h, ombak ${w.waveHeight}m`);
			}
		});
	} else {
		sections.push("");
		sections.push("\u{1F324}\uFE0F CUACA HARI INI");
		sections.push("Data cuaca belum tersedia.");
	}

	if (astronomy) {
		sections.push("");
		sections.push("\u{1F319} INFO LAUT");
		sections.push(`Sunrise: ${astronomy.sunrise} WIB | Sunset: ${astronomy.sunset} WIB`);
		sections.push(`Fase bulan: ${astronomy.moonPhase}`);
	}

	const message = sections.join("\n");

	console.log("[broadcast-morning] Sending broadcast, length:", message.length);

	try {
		await sendOpenClawAlert(message);
		return c.json({
			ok: true,
			sent: true,
			alertsCount: unsafeAlerts.length,
			weatherAvailable: weather !== null,
			astronomyAvailable: astronomy !== null,
		});
	} catch (err) {
		console.error("[broadcast-morning] Failed to send:", err);
		return c.json({ ok: true, sent: false, error: "Failed to send broadcast" }, 500);
	}
});

export default route;
