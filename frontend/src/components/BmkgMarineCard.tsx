import { Link } from "react-router-dom"
import { ArrowRight, Droplets, Thermometer, Wind } from "lucide-react"
import type { BmkgData } from "../services/reportService"
import { translateWindDirection } from "../utils/weatherUtils"
import { kmhToKnots } from "../lib/warning"
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
export function BmkgMarineCard({ data }: { data: BmkgData | null }) {
  // BMKG's public forecast API has no wave height, so it is not shown.
  if (!data) {
    return (
      <section className="rounded-2xl border-2 p-4 bg-white border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-lg">Prakiraan cuaca BMKG</p>
          <PerJamLink />
        </div>
        <p className="mt-1 text-base text-gray-600">Data BMKG sedang dimuat atau belum tersedia.</p>
      </section>
    )
  }

  const wTone = weatherTone(data)
  const aTone = windTone(data.windSpeed)
  const unusual = wTone !== "normal" || aTone !== "normal"
  const knots = kmhToKnots(data.windSpeed)
  const direction = data.windDirection ? translateWindDirection(data.windDirection) : ""

  return (
    <section className={`rounded-2xl border-2 p-4 ${unusual ? "bg-white border-orange-400" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-lg">Prakiraan cuaca BMKG</p>
        <PerJamLink />
      </div>
      <span className={`inline-block text-sm font-bold rounded-full px-3 py-1 ${unusual ? "bg-orange-500 text-black" : "bg-emerald-600 text-white"}`}>
        {unusual ? "Perlu waspada" : "Cuaca normal"}
      </span>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat Icon={weatherIcon(data.weather)} label="Cuaca" value={data.weather || "-"} tone={wTone}
          note={wTone !== "normal" ? "Cuaca buruk" : undefined} />
        <Stat Icon={Wind} label="Angin" value={`${data.windSpeed} km/jam`} tone={aTone}
          sub={`${knots} knot${direction ? ` · Arah: ${direction}` : ""}`}
          note={aTone === "siaga" ? "Sangat kencang" : aTone === "waspada" ? "Kencang" : undefined} />
        <Stat Icon={Thermometer} label="Suhu" value={`${data.temperature}°C`} tone="normal" />
        <Stat Icon={Droplets} label="Lembap" value={data.humidity != null ? `${data.humidity}%` : "-"} tone="normal" />
      </div>
    </section>
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
