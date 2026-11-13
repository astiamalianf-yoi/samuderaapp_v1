import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react"
import type { BmkgData } from "../services/reportService"
import { WIND_SIAGA_KMH, WIND_WASPADA_KMH } from "./warning"

export type Tone = "normal" | "waspada" | "siaga"

/** Icon for a BMKG weather description (Cerah, Cerah Berawan, Berawan, Hujan Ringan, Hujan Petir, …). */
export function weatherIcon(desc: string) {
  const d = desc.toLowerCase()
  if (/petir|badai/.test(d)) return CloudLightning
  if (/hujan\s*(ringan|lokal)|gerimis/.test(d)) return CloudDrizzle
  if (/hujan/.test(d)) return CloudRain
  if (/kabut|kabur|asap/.test(d)) return CloudFog
  if (/cerah\s*berawan/.test(d)) return CloudSun
  if (/berawan|mendung/.test(d)) return Cloud
  if (/cerah/.test(d)) return Sun
  return CloudSun
}

/** Rain or thunderstorm in the forecast = the "bad-weather forecast" row of the situation table (WASPADA). */
export function weatherTone(data: BmkgData): Tone {
  if (/hujan|petir|badai/i.test(data.weather)) return "waspada"
  if (!data.isSafe && data.windSpeed < WIND_WASPADA_KMH) return "waspada"
  return "normal"
}

/** Wind >= 46 km/h (~25 knot) = SIAGA, >= 30 km/h (~16 knot) = WASPADA, as in the situation table. */
export function windTone(kmh: number): Tone {
  if (kmh >= WIND_SIAGA_KMH) return "siaga"
  if (kmh >= WIND_WASPADA_KMH) return "waspada"
  return "normal"
}

