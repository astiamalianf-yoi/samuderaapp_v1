/**
 * BMKG test switch (UAT only). Lets a tester simulate, for at most one hour:
 * - the forecast of one beach (wind speed, a rain forecast, or "no BMKG data"), and
 * - an official BMKG warning (peringatan dini) written as a CAP document with an area text and/or
 *   a polygon, so the backend and the app match it to beaches with the same rules as a real one.
 *
 * Off unless BMKG_SIM_ENABLED=true; the control routes also need X-Research-Key. Every simulated
 * item is labelled "SIMULASI UAT" and expires after at most 60 minutes.
 */
import { redis } from "./redis";

export const SIM_ENABLED = () => process.env.BMKG_SIM_ENABLED === "true";
export const SIM_MAX_MINUTES = 60;

const WEATHER_KEY = (beach: string) => `bmkg:sim:weather:${beach}`;
const CAPS_KEY = "bmkg:sim:caps";

export type SimWeather = { windSpeed?: number; forecast?: "clear" | "cloudy" | "rain"; unavailable?: boolean; expiresAt: number };
export type SimWarning = {
	id: string;
	event: string;
	headline: string;
	description: string;
	areaDesc: string;
	polygon?: string; // "lat,lon lat,lon ..." as in CAP
	effective: number;
	expires: number;
};

const clampMinutes = (m: unknown) => Math.max(1, Math.min(SIM_MAX_MINUTES, Number(m) || SIM_MAX_MINUTES));

export async function setSimWeather(beach: string, w: Omit<SimWeather, "expiresAt">, minutes?: number): Promise<SimWeather> {
	const mins = clampMinutes(minutes);
	const value: SimWeather = { ...w, expiresAt: Date.now() + mins * 60_000 };
	await redis.set(WEATHER_KEY(beach), JSON.stringify(value), { EX: mins * 60 });
	await redis.del(`bmkg:data:${beach}`); // drop the cached real forecast so the change shows at once
	return value;
}

export async function getSimWeather(beach: string): Promise<SimWeather | null> {
	if (!SIM_ENABLED()) return null;
	try {
		const raw = await redis.get(WEATHER_KEY(beach));
		return raw ? (JSON.parse(raw) as SimWeather) : null;
	} catch {
		return null;
	}
}

/** Forecast values for a simulated beach (the same shape as the real BMKG forecast). */
export function simulatedBmkgData(beach: string, sim: SimWeather, base?: Record<string, unknown> | null) {
	const wind = sim.windSpeed ?? (typeof base?.windSpeed === "number" ? (base.windSpeed as number) : 8);
	const rain = sim.forecast === "rain";
	const cloudy = sim.forecast === "cloudy";
	const weatherCode = rain ? 63 : cloudy ? 3 : 1;
	return {
		beach,
		weather: `${rain ? "Hujan Sedang" : cloudy ? "Berawan" : "Cerah Berawan"} (SIMULASI UAT)`,
		windSpeed: wind,
		windDirection: "W",
		temperature: 28,
		humidity: 80,
		weatherCode,
		weatherIcon: "",
		description: "SIMULASI UAT",
		isSafe: !rain && wind < 30,
		fetchedAt: Date.now(),
	};
}

export async function addSimWarning(input: { event?: string; areaDesc?: string; polygon?: string; headline?: string; description?: string; minutes?: number }): Promise<SimWarning> {
	const now = Date.now();
	const mins = clampMinutes(input.minutes);
	const area = (input.areaDesc ?? "").trim();
	const w: SimWarning = {
		id: `sim-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
		event: input.event?.trim() || "Hujan Lebat disertai Petir dan Angin Kencang",
		headline: input.headline?.trim() || `SIMULASI UAT - Peringatan Dini Cuaca ${area || "wilayah uji"}`,
		description: input.description?.trim() || `SIMULASI UAT. Waspada potensi hujan lebat disertai petir dan angin kencang di ${area || "wilayah uji"}.`,
		areaDesc: area,
		polygon: input.polygon?.trim() || undefined,
		effective: now,
		expires: now + mins * 60_000,
	};
	const list = (await listSimWarnings()).concat(w);
	await redis.set(CAPS_KEY, JSON.stringify(list), { EX: SIM_MAX_MINUTES * 60 });
	return w;
}

export async function listSimWarnings(now = Date.now()): Promise<SimWarning[]> {
	if (!SIM_ENABLED()) return [];
	try {
		const raw = await redis.get(CAPS_KEY);
		return raw ? (JSON.parse(raw) as SimWarning[]).filter((w) => w.expires > now) : [];
	} catch {
		return [];
	}
}

export async function clearSims(beaches: string[]) {
	await redis.del(CAPS_KEY);
	for (const b of beaches) {
		await redis.del(WEATHER_KEY(b));
		await redis.del(`bmkg:data:${b}`);
	}
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A simulated warning as a CAP document (the format BMKG publishes). */
export function simWarningCap(w: SimWarning): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
<identifier>${esc(w.id)}</identifier>
<sender>SIMULASI UAT</sender>
<sent>${new Date(w.effective).toISOString()}</sent>
<status>Exercise</status>
<msgType>Alert</msgType>
<scope>Public</scope>
<info>
<language>id</language>
<event>${esc(w.event)}</event>
<effective>${new Date(w.effective).toISOString()}</effective>
<expires>${new Date(w.expires).toISOString()}</expires>
<headline>${esc(w.headline)}</headline>
<description>${esc(w.description)}</description>
<area>
<areaDesc>${esc(w.areaDesc)}</areaDesc>${w.polygon ? `\n<polygon>${esc(w.polygon)}</polygon>` : ""}
</area>
</info>
</alert>`;
}

/** The simulated warnings as an RSS feed, like BMKG's nowcast feed (links point to this API). */
export function simWarningsRss(list: SimWarning[], apiBase: string): string {
	const items = list
		.map((w) => `<item><title>${esc(w.headline)}</title><link>${esc(`${apiBase}/api/bmkg/sim/cap/${w.id}`)}</link><pubDate>${new Date(w.effective).toUTCString()}</pubDate></item>`)
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>SIMULASI UAT</title>${items}</channel></rss>`;
}
