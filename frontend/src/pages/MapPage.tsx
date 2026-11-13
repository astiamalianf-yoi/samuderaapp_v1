import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { LocateFixed } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BEACH_LOCATIONS } from "../constants/observationData"
import { reportService, type AlertFeedItem, type BmkgData } from "../services/reportService"
import { LEVELS, toLevel } from "../lib/warning"
import { useSelectedBeach } from "../hooks/useAppState"
import type { BeachLocation, RiskLevel } from "../types/api"

const BEACH_COORDS: Record<BeachLocation, [number, number]> = {
  pantai_lampuuk: [5.4833, 95.1333],
  pantai_lhoknga: [5.4667, 95.1167],
  pantai_ulee_lheue: [5.55, 95.3167],
  pantai_depok: [-8.0225, 110.33],
  pantai_samas: [-8.04, 110.31],
  pantai_pangandaran: [-7.6955, 108.653],
  pantai_batu_karas: [-7.7486, 108.4966],
  pantai_bojongsalawe: [-7.7033, 108.5275],
}

const REGIONS = [
  { label: "Yogyakarta", center: [-8.03, 110.32] as [number, number], zoom: 12 },
  { label: "Aceh", center: [5.5, 95.2] as [number, number], zoom: 11 },
  { label: "Jawa Barat", center: [-7.72, 108.57] as [number, number], zoom: 11 },
]

const COLOR: Record<RiskLevel, string> = { NORMAL: "#059669", WASPADA: "#f59e0b", SIAGA: "#ea580c", EKSTREM: "#b91c1c" }

function icon(level: RiskLevel) {
  return L.divIcon({
    html: `<div style="width:40px;height:40px;border-radius:50%;background:${COLOR[level]};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:900">${level === "NORMAL" ? "✓" : "!"}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: "",
  })
}

export function MapPage() {
  const [beach] = useSelectedBeach()
  const [alerts, setAlerts] = useState<AlertFeedItem[]>([])
  const [bmkg, setBmkg] = useState<BmkgData[]>([])
  const [me, setMe] = useState<[number, number] | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const startRegion = BEACH_COORDS[beach][0] > 0 ? REGIONS[1] : REGIONS[0]

  useEffect(() => {
    reportService.getAlerts(20).then(setAlerts).catch(() => undefined)
    reportService.getBmkgAll().then(setBmkg).catch(() => undefined)
  }, [])

  const levelOf = useMemo(() => {
    const out: Record<string, RiskLevel> = {}
    const cutoff = Date.now() - 6 * 60 * 60 * 1000
    for (const b of BEACH_LOCATIONS) {
      const recent = alerts.filter((a) => a.beachLocation === b.value && a.serverTimestamp >= cutoff)
      let lvl: RiskLevel = "NORMAL"
      for (const a of recent) {
        const l = toLevel(a.riskLevel)
        if (Object.keys(COLOR).indexOf(l) > Object.keys(COLOR).indexOf(lvl)) lvl = l
      }
      if (lvl === "NORMAL" && bmkg.find((x) => x.beach === b.value && !x.isSafe)) lvl = "WASPADA"
      out[b.value] = lvl
    }
    return out
  }, [alerts, bmkg])

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude]
        setMe(pos)
        mapRef.current?.flyTo(pos, 13, { duration: 1 })
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <AppShell title="Peta" bleed showWhatsApp={false}>
      <div className="relative" style={{ height: "calc(100dvh - 3.5rem - 4rem - var(--safe-area-inset-bottom) - var(--safe-area-inset-top))" }}>
        <div className="absolute top-3 left-16 right-3 z-[500] flex gap-2">
          {REGIONS.map((r) => (
            <button key={r.label} onClick={() => mapRef.current?.flyTo(r.center, r.zoom, { duration: 1 })}
              className="min-h-11 px-4 rounded-full bg-white shadow font-bold text-base">{r.label}</button>
          ))}
          <button onClick={locate} aria-label="Lokasi saya" className="ml-auto w-11 h-11 rounded-full bg-white shadow flex items-center justify-center">
            <LocateFixed className="w-6 h-6 text-sky-800" />
          </button>
        </div>
        <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 shadow p-2 text-sm space-y-1">
          {(Object.keys(COLOR) as RiskLevel[]).map((l) => (
            <p key={l} className="flex items-center gap-2"><span className="w-4 h-4 rounded-full" style={{ background: COLOR[l] }} />{LEVELS[l].label}</p>
          ))}
        </div>
        <MapContainer center={startRegion.center} zoom={startRegion.zoom} ref={mapRef} style={{ height: "100%", width: "100%" }}>
          {/* OpenStreetMap's own tiles: no API key. CARTO's basemaps began to require one (Nov 2026)
              and showed "API KEY REQUIRED" instead of the map. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {BEACH_LOCATIONS.map((b) => {
            const lvl = levelOf[b.value] ?? "NORMAL"
            const w = bmkg.find((x) => x.beach === b.value)
            return (
              <Marker key={b.value} position={BEACH_COORDS[b.value]} icon={icon(lvl)}>
                <Popup>
                  <div className="text-base space-y-1 min-w-[190px]">
                    <p className="font-bold text-lg">{b.label}</p>
                    <p><b>Status:</b> {LEVELS[lvl].label}</p>
                    {w && (
                      <>
                        <p>{w.weather}</p>
                        <p>Angin {w.windSpeed} km/j {w.windDirection} · {w.temperature}°C</p>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
          {me && (
            <Marker position={me} icon={L.divIcon({
              html: '<div style="width:20px;height:20px;border-radius:50%;background:#0ea5e9;border:3px solid #fff;box-shadow:0 0 8px rgba(14,165,233,.6)"></div>',
              iconSize: [20, 20], iconAnchor: [10, 10], className: "" })}>
              <Popup>Lokasi Anda</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </AppShell>
  )
}
