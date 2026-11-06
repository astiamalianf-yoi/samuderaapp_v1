import { redis } from "../lib/redis";
import { BMKG_CACHE_TTL_SECONDS } from "../config";

export type BmkgData = {
	beach: string;
	weather: string;
	windSpeed: number;
	windDirection: string;
	temperature: number;
	humidity: number;
	weatherCode: number;
	weatherIcon: string;
	description: string;
	isSafe: boolean;
	fetchedAt: number;
};

const WIND_UNSAFE_THRESHOLD = 30;

const BMKG_WEATHER_UNSAFE_CODES = new Set([
	60, 61, 63, 65, 66, 67,
	71, 73, 75, 77,
	80, 81, 82, 83, 84, 85, 86,
	95, 96, 99,
]);

// BMKG village (adm4) per beach; keep equal to frontend/src/constants/observationData.ts.
const BEACH_ADM4_CODES: Record<string, string> = {
	pantai_lampuuk: "11.06.02.2023", // Meunasah Mesjid Lampuuk, Lhoknga (was Weuraya)
	pantai_lhoknga: "11.06.02.2001",
	pantai_ulee_lheue: "11.71.03.2002",
	pantai_depok: "34.02.03.2002",
	pantai_samas: "34.02.02.2003", // Srigading, Sanden (was a village in Kretek)
};

const ALLOWED_BEACHES = Object.keys(BEACH_ADM4_CODES) as (keyof typeof BEACH_ADM4_CODES)[];

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const res = await fetch(url, {
			headers: { "Accept": "application/json", "User-Agent": "DisasterWarningApp/1.0" },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

interface BmkgCuacaItem {
	datetime: string;
	t: number;
	weather: number;
	weather_desc: string;
	weather_desc_en: string;
	wd: string;
	ws: number;
	hu: number;
	image: string;
	local_datetime: string;
}

interface BmkgResponse {
	lokasi: {
		provinsi: string;
		kotkab: string;
		kecamatan: string;
		desa: string;
		lon: number;
		lat: number;
	};
	data: Array<{
		lokasi: { desa: string; lon: number; lat: number; type: string };
		cuaca: BmkgCuacaItem[][];
	}>;
}

function isBeachValid(beach: string): beach is keyof typeof BEACH_ADM4_CODES {
	return beach in BEACH_ADM4_CODES;
}

async function fetchFreshBmkgData(beach: string): Promise<BmkgData | null> {
	if (!isBeachValid(beach)) return null;

	const adm4 = BEACH_ADM4_CODES[beach];
	const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`;

	const data = await fetchJson<BmkgResponse>(url);
	if (!data?.data?.length) return null;

	const latestPeriod = data.data[0];
	const cuacaSlots = latestPeriod.cuaca.flat();
	if (!cuacaSlots.length) return null;

	const current = cuacaSlots[0];

	return {
		beach,
		weather: current.weather_desc ?? "Tidak tersedia",
		windSpeed: current.ws ?? 0,
		windDirection: current.wd ?? "Tidak tersedia",
		temperature: current.t ?? 27,
		humidity: current.hu ?? 0,
		weatherCode: current.weather ?? 0,
		weatherIcon: current.image ?? "",
		description: `${data.lokasi.kecamatan}, ${data.lokasi.kotkab}, ${data.lokasi.provinsi}`,
		isSafe: !BMKG_WEATHER_UNSAFE_CODES.has(current.weather) && (current.ws ?? 0) < WIND_UNSAFE_THRESHOLD,
		fetchedAt: Date.now(),
	};
}

export async function getBmkgData(beach: string): Promise<BmkgData | null> {
	if (!isBeachValid(beach)) return null;

	const cacheKey = `bmkg:data:${beach}`;
	const cached = await redis.get(cacheKey);
	if (cached) {
		try {
			return JSON.parse(cached) as BmkgData;
		} catch {
			await redis.del(cacheKey);
		}
	}

	const fresh = await fetchFreshBmkgData(beach);
	if (fresh) {
		await redis.set(cacheKey, JSON.stringify(fresh), { EX: BMKG_CACHE_TTL_SECONDS });
		return fresh;
	}

	return null;
}

export async function getAllBmkgData(): Promise<BmkgData[]> {
	const results = await Promise.all(
		ALLOWED_BEACHES.map((beach) => getBmkgData(beach)),
	);
	return results.filter((r): r is BmkgData => r !== null);
}

export { ALLOWED_BEACHES, isBeachValid };
