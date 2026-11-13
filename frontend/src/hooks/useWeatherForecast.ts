import { useEffect, useState } from "react"
import { WEATHER_CONFIG } from "../constants/weatherConfig"
import { filterTodaySlots, findClosestTimeSlot, translateWindDirection } from "../utils/weatherUtils"
import { BEACH_LOCATIONS } from "../constants/observationData"
import { API_BASE_URL } from "../config"

/**
 * BMKG's forecast comes through our backend (cached there): browsers cannot call api.bmkg.go.id
 * directly ("Gagal memuat prakiraan cuaca", UAT 14 Nov 2026). A village that is not one of the
 * beaches falls back to BMKG directly.
 */
function forecastUrl(adm4: string): string {
  const beach = BEACH_LOCATIONS.find((b) => b.adm4Code === adm4)?.value
  return beach ? `${API_BASE_URL}/api/bmkg/${beach}/forecast` : `${WEATHER_CONFIG.BMKG_API_PROXY}?adm4=${adm4}`
}

export interface BmkgForecastItem {
  local_datetime: string
  t: number | string
  hu: number | string
  weather_desc: string
  ws: number | string
  wd: string
  vs_text: string
}

interface BmkgForecastResponse {
  data: Array<{
    cuaca: BmkgForecastItem[][]
  }>
}

export interface TodayForecastData {
  windSpeed: string
  windDirection: string
  condition: string
  temperature: string
  humidity: string
  visibility: string
}

export function useWeatherForecast(adm4Code?: string) {
  const [data, setData] = useState<TodayForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const code = adm4Code ?? WEATHER_CONFIG.DEFAULT_ADM4_CODE

  useEffect(() => {
    const controller = new AbortController()

    async function fetchForecast() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(
          forecastUrl(code),
          { signal: controller.signal },
        )

        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }

        const json = (await res.json()) as BmkgForecastResponse
        const cuaca = json.data?.[0]?.cuaca

        if (!Array.isArray(cuaca)) {
          throw new Error("Struktur data BMKG tidak sesuai ekspektasi")
        }

        const allSlots: BmkgForecastItem[] = cuaca.flat()
        const now = new Date()
        let todaySlots = filterTodaySlots(allSlots, now)

        if (todaySlots.length === 0 && allSlots.length > 0) {
          todaySlots = [allSlots[0]]
        }

        if (todaySlots.length === 0) {
          throw new Error("Tidak ada data prakiraan dari BMKG")
        }

        const bestSlot = findClosestTimeSlot(todaySlots, now)
        if (!bestSlot) {
          throw new Error("Tidak dapat menemukan slot prakiraan yang sesuai")
        }

        const temp = Number(bestSlot.t)
        const ws = Number(bestSlot.ws)
        const hu = Number(bestSlot.hu)

        setData({
          windSpeed: Number.isFinite(ws) ? `${ws} km/jam` : `${bestSlot.ws} km/jam`,
          windDirection: bestSlot.wd ? `Arah: ${translateWindDirection(bestSlot.wd)}` : "Arah: -",
          condition: bestSlot.weather_desc || "Cuaca tidak diketahui",
          temperature: Number.isFinite(temp) ? `${temp.toFixed(0)}°C` : `${bestSlot.t}°C`,
          humidity: Number.isFinite(hu) ? `${hu.toFixed(0)}%` : `${bestSlot.hu}%`,
          visibility: bestSlot.vs_text || "-",
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
        setError("Gagal memuat prakiraan cuaca hari ini.")
      } finally {
        setLoading(false)
      }
    }

    fetchForecast()
    return () => controller.abort()
  }, [code])

  return { data, loading, error }
}

export function useAllWeatherForecasts(adm4Code?: string) {
  const [data, setData] = useState<BmkgForecastItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const code = adm4Code ?? WEATHER_CONFIG.DEFAULT_ADM4_CODE

  useEffect(() => {
    const controller = new AbortController()

    async function fetchForecast() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(
          forecastUrl(code),
          { signal: controller.signal },
        )

        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }

        const json = (await res.json()) as BmkgForecastResponse
        const cuaca = json.data?.[0]?.cuaca

        if (!Array.isArray(cuaca)) {
          throw new Error("Struktur data BMKG tidak sesuai ekspektasi")
        }

        const allSlots: BmkgForecastItem[] = cuaca.flat()
        setData(allSlots)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
        setError("Gagal memuat prakiraan cuaca.")
      } finally {
        setLoading(false)
      }
    }

    fetchForecast()
    return () => controller.abort()
  }, [code])

  return { data, loading, error }
}
