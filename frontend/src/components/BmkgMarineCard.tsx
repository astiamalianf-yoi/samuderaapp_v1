import { Droplets, Wind, Thermometer } from "lucide-react"
import type { BmkgData } from "../services/reportService"

/** Marine weather from BMKG for the selected beach (backend /api/bmkg/:beach). */
export function BmkgMarineCard({ data }: { data: BmkgData | null }) {
  // BMKG's public forecast API has no wave height, so it is not shown.
  if (!data) return null
  return (
    <section className={`rounded-2xl border-2 p-4 ${data.isSafe ? "bg-white border-gray-200" : "bg-amber-50 border-amber-400"}`}>
      <div className="flex items-center justify-between">
        <p className="font-bold text-lg">Prakiraan cuaca BMKG</p>
        <span className={`text-sm font-bold rounded-full px-3 py-1 ${data.isSafe ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}`}>
          {data.isSafe ? "Cuaca normal" : "Cuaca buruk"}
        </span>
      </div>
      <p className="mt-1 text-base text-gray-700">{data.weather}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat Icon={Droplets} label="Lembap" value={data.humidity != null ? `${data.humidity}%` : "-"} />
        <Stat Icon={Wind} label="Angin" value={`${data.windSpeed} km/j`} sub={data.windDirection} />
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
