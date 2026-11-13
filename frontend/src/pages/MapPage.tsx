import { useEffect, useRef, useState } from "react"
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { LocateFixed } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BEACH_LOCATIONS } from "../constants/observationData"
import { reportService, type BeachStatus } from "../services/reportService"
import { LEVELS } from "../lib/warning"
import { getSign } from "../constants/signs"
import { useSelectedBeach } from "../hooks/useAppState"
import type { BeachLocation, RiskLevel } from "../types/api"

/**
 * On the beach itself (checked 14 Nov 2026 against public map coordinates); the earlier values for
 * the Aceh and Bantul beaches lay 2-10 km out at sea.
 */
const BEACH_COORDS: Record<BeachLocation, [number, number]> = {
  pantai_lampuuk: [5.4906, 95.2275],
  pantai_lhoknga: [5.4794, 95.2316],
  pantai_ulee_lheue: [5.5598, 95.2853],
  pantai_depok: [-8.0140, 110.2924],
  pantai_samas: [-8.0030, 110.2620],
  pantai_pangandaran: [-7.6961, 108.6536],
  pantai_batu_karas: [-7.7486, 108.4966],
  pantai_bojongsalawe: [-7.7033, 108.5275],
}

const REGIONS = [
  { label: "Yogyakarta", center: [-8.01, 110.28] as [number, number], zoom: 12 },
  { label: "Aceh", center: [5.52, 95.26] as [number, number], zoom: 11 },
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
  const [status, setStatus] = useState<BeachStatus[]>([])
  const [me, setMe] = useState<[number, number] | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const startRegion = BEACH_COORDS[beach][0] > 0 ? REGIONS[1] : REGIONS[0]

  // Same rule as the Beranda card: fishermen's warning and BMKG together (both SIAGA = BAHAYA).
  useEffect(() => {
    const load = () => reportService.getMapStatus().then(setStatus).catch(() => undefined)
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

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
            const st = status.find((x) => x.beach === b.value)
            const lvl: RiskLevel = st?.level ?? "NORMAL"
            const fmt = (ms: number | null) => ms ? new Date(ms).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : null
            const source = st?.lik && st.bmkg.level !== "NORMAL" ? "Peringatan dari nelayan dan BMKG"
              : st?.lik ? "Peringatan dari nelayan" : st && st.bmkg.level !== "NORMAL" ? "Peringatan dari BMKG" : null
            return (
              <Marker key={b.value} position={BEACH_COORDS[b.value]} icon={icon(lvl)}>
                <Popup>
                  <div className="text-base space-y-1 min-w-[200px]">
                    <p className="font-bold text-lg">{b.label}</p>
                    <p><b>Status:</b> {LEVELS[lvl].label}</p>
                    {source && <p className="text-sm font-semibold text-gray-700">{source}</p>}
                    {st?.lik && (
                      <p>🐟 Tanda alam: {st.lik.codes.map((c) => getSign(c)?.short ?? c).join(", ")}</p>
                    )}
                    {st?.bmkg.warnings.map((w) => (
                      <p key={w.event + w.expires}>⚠️ BMKG: {w.event}{fmt(w.expires) ? ` sampai ${fmt(w.expires)} WIB` : ""}</p>
                    ))}
                    {st?.bmkg.weather && (
                      <p className="text-sm text-gray-700">
                        {st.bmkg.weather}{st.bmkg.windSpeed != null ? ` · Angin ${st.bmkg.windSpeed} km/j ${st.bmkg.windDirection ?? ""}` : ""}{st.bmkg.temperature != null ? ` · ${st.bmkg.temperature}°C` : ""}
                      </p>
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
