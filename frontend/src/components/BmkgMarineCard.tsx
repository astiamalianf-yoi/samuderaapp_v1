import { Link } from "react-router-dom"
import { ArrowRight, Droplets, Thermometer, Wind } from "lucide-react"
import type { BmkgData } from "../services/reportService"
import { translateWindDirection } from "../utils/weatherUtils"
import { assessBmkg, kmhToKnots } from "../lib/warning"
import type { WeatherAlertProps } from "./WeatherAlertCard"
import { weatherIcon, weatherTone, windTone, type Tone } from "../lib/weatherTone"

const TONE_BOX: Record<Tone, string> = {
  normal: "bg-slate-50 border-transparent",
  waspada: "bg-orange-100 border-orange-500",
  siaga: "bg-red-100 border-red-600",
}
const TONE_ICON: Record<Tone, string> = {
  normal: "text-sky-800",
  waspada: "text-orange-700",
  siaga: "text-red-700",
}

function PerJamLink() {
  return (
    <Link to="/forecast" className="min-h-11 flex items-center gap-1 text-base font-semibold text-sky-800 shrink-0">
      Per jam <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  )
}

/**
 * The one weather card on the home screen: BMKG village forecast for the selected beach, current
 * time slot (backend /api/bmkg/:beach, the same value the warning decision uses). A box turns
 * orange (WASPADA) or red (SIAGA) when its value crosses a limit of the BMKG situation table.
 * "Per jam" opens the following time slots of the same forecast.
 */
export function BmkgMarineCard({ data, alerts = [], beachLabel }: { data: BmkgData | null; alerts?: WeatherAlertProps[]; beachLabel?: string }) {
  const title = `Prakiraan cuaca BMKG${beachLabel ? ` · ${beachLabel}` : ""}`
  // An official BMKG warning (peringatan dini) covering this beach and not yet expired is SIAGA in
  // the situation table, whatever the ordinary forecast for this time slot says. Same check as the
  // status card (assessBmkg), so the two cards always agree.
  const official = assessBmkg(data, alerts).warnings[0]
  // BMKG's public forecast API has no wave height, so it is not shown.
  if (!data) {
    return (
      <section className="rounded-2xl border-2 p-4 bg-white border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-lg">{title}</p>
          <PerJamLink />
        </div>
        {official && <OfficialBadge />}
        <p className="mt-1 text-base text-gray-600">Data BMKG sedang dimuat atau belum tersedia.</p>
      </section>
    )
  }

  const wTone = official ? "siaga" : weatherTone(data)
  const aTone = windTone(data.windSpeed)
  const siaga = wTone === "siaga" || aTone === "siaga"
  const unusual = wTone !== "normal" || aTone !== "normal"
  const knots = kmhToKnots(data.windSpeed)
  const direction = data.windDirection ? translateWindDirection(data.windDirection) : ""

  return (
    <section className={`rounded-2xl border-2 p-4 bg-white ${siaga ? "border-red-500" : unusual ? "border-orange-400" : "border-gray-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-lg">{title}</p>
        <PerJamLink />
      </div>
      {official ? (
        <OfficialBadge />
      ) : (
        <span className={`inline-block text-sm font-bold rounded-full px-3 py-1 ${
          siaga ? "bg-red-600 text-white" : unusual ? "bg-orange-500 text-black" : "bg-emerald-600 text-white"}`}>
          {siaga ? "Bahaya" : unusual ? "Perlu waspada" : "Cuaca normal"}
        </span>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {official ? (
          // While an official warning covers the beach, show only the warning: the routine forecast was made
          // earlier and can contradict it (e.g. "Hujan Ringan" under a heavy-rain warning), 14 Nov 2026.
          <Stat Icon={weatherIcon(official.condition)} label="Cuaca" value={official.condition} tone="siaga"
            note={`Berlaku s.d. ${official.end}`} />
        ) : (
          <Stat Icon={weatherIcon(data.weather)} label="Cuaca" value={data.weather || "-"} tone={wTone}
            note={wTone !== "normal" ? "Cuaca buruk" : undefined} />
        )}
        <Stat Icon={Wind} label="Angin" value={`${data.windSpeed} km/jam`} tone={aTone}
          sub={`${knots} knot${direction ? ` · Arah: ${direction}` : ""}`}
          note={aTone === "siaga" ? "Sangat kencang" : aTone === "waspada" ? "Kencang" : undefined} />
        <Stat Icon={Thermometer} label="Suhu" value={`${data.temperature}°C`} tone="normal" />
        <Stat Icon={Droplets} label="Lembap" value={data.humidity != null ? `${data.humidity}%` : "-"} tone="normal" />
      </div>
    </section>
  )
}

function OfficialBadge() {
  return (
    <span className="inline-block text-sm font-bold rounded-full px-3 py-1 bg-red-600 text-white">
      Peringatan BMKG aktif
    </span>
  )
}

function Stat({ Icon, label, value, sub, note, tone }: {
  Icon: typeof Wind; label: string; value: string; sub?: string; note?: string; tone: Tone
}) {
  return (
    <div className={`rounded-xl border-2 p-3 ${TONE_BOX[tone]}`} data-tone={tone} aria-label={`${label}: ${value}${note ? `, ${note}` : ""}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-7 h-7 ${TONE_ICON[tone]}`} aria-hidden />
        <p className="text-base text-gray-700">{label}</p>
      </div>
      <p className="mt-1 text-xl font-extrabold leading-tight">{value}</p>
      {sub && <p className="text-sm text-gray-600">{sub}</p>}
      {note && <p className={`mt-1 text-sm font-bold ${TONE_ICON[tone]}`}>⚠ {note}</p>}
    </div>
  )
}
