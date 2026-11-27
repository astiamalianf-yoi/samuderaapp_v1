import { CloudSun, Droplets, Thermometer, Wind } from "lucide-react"
import type { ComponentType } from "react"
import { useWeatherForecast } from "../hooks/useWeatherForecast"

export interface StatCardProps {
  label: string
  value: string
  sub?: string
  icon: ComponentType<{ className?: string; [k: string]: unknown }>
}

function StatCard({ label, value, sub, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" aria-hidden />
          {label}
        </span>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold">{value}</div>
        {sub ? <div className="text-xs text-gray-500">{sub}</div> : null}
      </div>
    </div>
  )
}

interface TodayForecastProps {
  adm4Code?: string  
}

export function TodayForecast({ adm4Code }: TodayForecastProps) {
  const { data, loading, error } = useWeatherForecast(adm4Code)

  if (loading) {
    return <p className="text-sm text-gray-500">Memuat prakiraan cuaca hari ini…</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (!data) {
    return null
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <StatCard
          label="Angin"
          value={data.windSpeed}
          sub={data.windDirection}
          icon={Wind}
        />
        <StatCard
          label="Cuaca"
          value={data.condition}
          sub={data.visibility !== "-" ? `Jarak pandang: ${data.visibility}` : ""}
          icon={CloudSun}
        />
        <StatCard
          label="Suhu Udara"
          value={data.temperature}
          icon={Thermometer}
        />
        <StatCard
          label="Kelembapan"
          value={data.humidity}
          icon={Droplets}
        />
      </div>
    </div>
  )
}

export default TodayForecast
