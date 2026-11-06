import { Link } from "react-router-dom"
import { ArrowRight, Droplets, Wind, Thermometer } from "lucide-react"
import type { BmkgData } from "../services/reportService"
import { translateWindDirection } from "../utils/weatherUtils"

function PerJamLink() {
  return (
    <Link to="/forecast" className="min-h-11 flex items-center gap-1 text-base font-semibold text-sky-800 shrink-0">
      Per jam <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  )
}

/**
 * The one weather card on the home screen: BMKG village forecast for the selected beach, current
 * time slot (backend /api/bmkg/:beach, the same value the warning decision uses). "Per jam" opens
 * the following time slots of the same forecast.
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
  return (
    <section className={`rounded-2xl border-2 p-4 ${data.isSafe ? "bg-white border-gray-200" : "bg-amber-50 border-amber-400"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-lg">Prakiraan cuaca BMKG</p>
        <PerJamLink />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-base text-gray-700">{data.weather}</p>
        <span className={`text-sm font-bold rounded-full px-3 py-1 ${data.isSafe ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}`}>
          {data.isSafe ? "Cuaca normal" : "Cuaca buruk"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat Icon={Droplets} label="Lembap" value={data.humidity != null ? `${data.humidity}%` : "-"} />
        <Stat Icon={Wind} label="Angin" value={`${data.windSpeed} km/j`} sub={data.windDirection ? `Arah: ${translateWindDirection(data.windDirection)}` : undefined} />
        <Stat Icon={Thermometer} label="Suhu" value={`${data.temperature}°C`} />
      </div>
    </section>
  )
}

function Stat({ Icon, label, value, sub }: { Icon: typeof Wind; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <Icon className="w-6 h-6 mx-auto text-sky-800" aria-hidden />
      <p className="text-xs text-gray-600 mt-1">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
