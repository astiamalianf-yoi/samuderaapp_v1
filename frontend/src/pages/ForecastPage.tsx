import { useState, useMemo } from "react"
import { MainLayout } from "../components/layout/MainLayout"
import { ArrowLeft, CloudSun, Droplets, MapPin, Thermometer, Wind } from "lucide-react"
import { BEACH_LOCATIONS, getBeachMeta } from "../constants/observationData"
import type { BeachLocation } from "../types/api"
import { useAllWeatherForecasts, type BmkgForecastItem } from "../hooks/useWeatherForecast"
import { translateWindDirection } from "../utils/weatherUtils"

export function ForecastPage() {
  const [selectedBeach, setSelectedBeach] = useState<BeachLocation>("pantai_depok")
  const selectedBeachLabel =
    BEACH_LOCATIONS.find((beach) => beach.value === selectedBeach)?.label ?? "Pilih Pantai"
  const selectedBeachMeta = getBeachMeta(selectedBeach)

  const { data, loading, error } = useAllWeatherForecasts(selectedBeachMeta?.adm4Code)

  const groupedData = useMemo(() => {
    if (!data) return {}
    return data.reduce((acc: Record<string, BmkgForecastItem[]>, curr) => {
      const datePart = curr.local_datetime.split(" ")[0]
      if (!acc[datePart]) {
        acc[datePart] = []
      }
      acc[datePart].push(curr)
      return acc
    }, {})
  }, [data])

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mt-2">
          <a
            href="/"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-200 text-gray-700 hover:bg-gray-50"
            aria-label="Kembali ke Beranda"
          >
            <ArrowLeft className="w-5 h-5" />
          </a>
          <h1 className="text-xl font-bold">Prakiraan Cuaca</h1>
        </div>

        {/* Location Selector */}
        <div className="space-y-2 bg-white p-3 rounded-lg border border-gray-200">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-700">
            <MapPin className="w-4 h-4 text-primary" aria-hidden />
            {selectedBeachLabel}
          </h2>
          <select
            value={selectedBeach}
            onChange={(event) => setSelectedBeach(event.target.value as BeachLocation)}
            className="w-full bg-gray-50 rounded-lg border border-gray-300 text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Pilih lokasi pantai"
          >
            {BEACH_LOCATIONS.map((beach) => (
              <option key={beach.value} value={beach.value}>
                {beach.label}
              </option>
            ))}
          </select>
        </div>

        {/* Forecast Content */}
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Memuat data prakiraan BMKG...</p>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        ) : Object.keys(groupedData).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Tidak ada data prakiraan tersedia.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([dateStr, items]) => (
              <div key={dateStr} className="space-y-3">
                <h3 className="font-bold text-gray-800 bg-gray-100 py-1.5 px-3 rounded-md text-sm">
                  {formatDateLabel(dateStr)}
                </h3>
                <div className="grid gap-4">
                  {items.map((item) => {
                    const time = item.local_datetime.split(" ")[1].substring(0, 5)
                    return (
                      <div key={item.local_datetime} className="bg-white p-4 rounded-xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow flex items-center gap-5">
                        <div className="w-16 flex flex-col items-center justify-center border-r border-indigo-50 pr-4">
                          <span className="text-xl font-black text-indigo-600 tracking-tight">{time}</span>
                          <span className="text-xs font-medium text-gray-400 uppercase">WIB</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CloudSun className="w-5 h-5 text-orange-500" />
                              <span className="font-bold text-gray-800">{item.weather_desc}</span>
                            </div>
                            <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-sm font-bold">
                              <Thermometer className="w-3.5 h-3.5" />
                              {item.t}°C
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mt-1">
                            <div className="flex items-center gap-1.5 bg-blue-50/50 px-2 py-1 rounded-md">
                              <Droplets className="w-4 h-4 text-blue-500" />
                              <span>{item.hu}%</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-teal-50/50 px-2 py-1 rounded-md">
                              <Wind className="w-4 h-4 text-teal-600" />
                              <span>{item.ws} km/jam ({translateWindDirection(item.wd)})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
