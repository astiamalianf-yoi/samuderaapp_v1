import { useEffect, useState } from "react"
import type { WeatherAlertProps } from "../components/WeatherAlertCard"
import { WEATHER_CONFIG, PROXY_REPLACEMENTS } from "../constants/weatherConfig"
import {
  formatDateToID,
  formatTimeWIB,
  buildRecommendation,
  proxifyBmkgUrl,
  extractLocation,
} from "../utils/weatherUtils"
import type { BeachLocation } from "../types/api"
import { capAppliesToBeach } from "../utils/bmkgArea"

const locationKeywords: Record<BeachLocation, string[]> = {
  pantai_lampuuk: ["Aceh Besar", "Aceh"],
  pantai_lhoknga: ["Aceh Besar", "Aceh"],
  pantai_ulee_lheue: ["Banda Aceh", "Aceh"],
  pantai_depok: ["Bantul", "DI Yogyakarta", "Yogyakarta", "DIY"],
  pantai_samas: ["Bantul", "DI Yogyakarta", "Yogyakarta", "DIY"],
  pantai_pangandaran: ["Pangandaran", "Jawa Barat"],
  pantai_batu_karas: ["Pangandaran", "Jawa Barat"],
  pantai_bojongsalawe: ["Pangandaran", "Jawa Barat"],
}

/**
 * One CAP document -> one alert. `alertKey` is the CAP link, so a detail page can always open the
 * same warning (a list position is not stable: the home list is filtered by beach, the full list is not).
 */
export function mapCapToAlert(
  capText: string,
  item: { title: string; pubDate: string; link: string },
  selectedBeach?: BeachLocation,
): WeatherAlertProps {
  const capXml = new DOMParser().parseFromString(capText, "application/xml")
  const info = capXml.getElementsByTagNameNS("*", "info")[0]
  const tag = (name: string) => info?.getElementsByTagNameNS("*", name)[0]?.textContent ?? ""
  const event = tag("event")
  const effective = tag("effective")
  const expires = tag("expires")
  const headline = tag("headline")
  const description = tag("description")

  const polygons = Array.from(info?.getElementsByTagNameNS("*", "polygon") ?? []).map((n) => n.textContent ?? "")
  const areaDescs = Array.from(info?.getElementsByTagNameNS("*", "areaDesc") ?? []).map((n) => n.textContent ?? "")
  const expiresAt = expires ? Date.parse(expires) : NaN
  const appliesToBeach = selectedBeach
    ? capAppliesToBeach(selectedBeach, { polygons, areaDescs, description, headline })
    : true
  return {
    alertKey: item.link,
    location: extractLocation(headline, item.title),
    date: formatDateToID(effective || item.pubDate),
    start: formatTimeWIB(effective),
    end: formatTimeWIB(expires),
    condition: event || "Peringatan Cuaca",
    forecast: description || "Peringatan dini cuaca dari BMKG.",
    recommendation: buildRecommendation(event, description),
    appliesToBeach,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  }
}

/** Loads one BMKG warning by its CAP link (used by the detail page when opened directly). */
export function useCapAlert(link: string | null) {
  const [alert, setAlert] = useState<WeatherAlertProps | null>(null)
  const [loading, setLoading] = useState(Boolean(link))

  useEffect(() => {
    if (!link) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch(proxifyBmkgUrl(link, PROXY_REPLACEMENTS), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`CAP status ${res.status}`)
        return res.text()
      })
      .then((text) => setAlert(mapCapToAlert(text, { title: "", pubDate: "", link })))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
        setAlert(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [link])

  return { alert, loading }
}

export function useWeatherAlerts(selectedBeach?: BeachLocation, disableFilter: boolean = false, enabled: boolean = true) {
  const [alerts, setAlerts] = useState<WeatherAlertProps[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()

    async function fetchAlerts() {
      try {
        setLoading(true)
        setError(null)

        const rssRes = await fetch(WEATHER_CONFIG.BMKG_RSS_PROXY, {
          signal: controller.signal,
        })
        const rssText = await rssRes.text()

        const parser = new DOMParser()
        const rssXml = parser.parseFromString(rssText, "application/xml")
        const allItems = Array.from(rssXml.querySelectorAll("item"))

        let filteredItems = allItems;
        if (selectedBeach && !disableFilter) {
          const keywords = locationKeywords[selectedBeach];
          filteredItems = allItems.filter(item => {
            const title = item.querySelector("title")?.textContent?.toLowerCase() || "";
            return keywords.some(kw => title.includes(kw.toLowerCase()));
          });
        }

        const items = filteredItems.slice(0, WEATHER_CONFIG.MAX_ALERTS_TO_FETCH)

        const mappedAlerts: WeatherAlertProps[] = []

        for (const item of items) {
          const title = item.querySelector("title")?.textContent ?? ""
          const link = item.querySelector("link")?.textContent ?? ""
          const pubDate = item.querySelector("pubDate")?.textContent ?? ""

          if (!link) continue

          const proxiedLink = proxifyBmkgUrl(link, PROXY_REPLACEMENTS)
          const capRes = await fetch(proxiedLink, { signal: controller.signal })

          if (!capRes.ok) {
            throw new Error(`CAP status ${capRes.status}`)
          }

          const capText = await capRes.text()
          const mappedAlert = mapCapToAlert(capText, { title, pubDate, link }, selectedBeach)
          const appliesToBeach = mappedAlert.appliesToBeach
          
          mappedAlerts.push(mappedAlert)

          // Notification Logic
          const alertId = `${mappedAlert.location}-${mappedAlert.start}-${mappedAlert.end}`
          const seenStr = localStorage.getItem("notified_weather_alerts") || "[]"
          let seen: string[] = []
          try {
            seen = JSON.parse(seenStr)
          } catch {
            seen = []
          }

          if (appliesToBeach && !seen.includes(alertId)) {
            seen.push(alertId)
            if (seen.length > 20) seen.shift()
            localStorage.setItem("notified_weather_alerts", JSON.stringify(seen))

            if ("serviceWorker" in navigator) {
              if (Notification.permission === "granted") {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification(`Peringatan BMKG: ${mappedAlert.location}`, {
                    body: `${mappedAlert.condition} akan terjadi pada ${mappedAlert.date}, ${mappedAlert.start}\n\n${mappedAlert.recommendation}`,
                    tag: alertId,
                    data: { url: "/" },
                    icon: "/192x192.png",
                  }).catch(console.error)
                }).catch(console.error)
              }
            }
          }
        }

        mappedAlerts.sort((a, b) => Number(!!b.appliesToBeach) - Number(!!a.appliesToBeach))
        setAlerts(mappedAlerts)
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error(err)
        setError("Gagal memuat data peringatan cuaca.")
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
    return () => controller.abort()
  }, [selectedBeach, disableFilter, enabled])

  return { alerts, loading, error }
}
