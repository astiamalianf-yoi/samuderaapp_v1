import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import WeatherAlertCard from "./WeatherAlertCard"
import WeatherAlertSkeleton from "./WeatherAlertSkeleton"
import { useWeatherAlerts } from "../hooks/useWeatherAlerts"
import type { BeachLocation } from "../types/api"

interface WeatherAlertListProps {
  selectedBeach?: BeachLocation;
  disableFilter?: boolean;
}

export function WeatherAlertList({ selectedBeach, disableFilter = false }: WeatherAlertListProps) {
  const { alerts, loading, error } = useWeatherAlerts(selectedBeach, disableFilter)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (alerts.length === 0) {
      setActiveIndex(0)
      return
    }

    if (activeIndex > alerts.length - 1) {
      setActiveIndex(alerts.length - 1)
    }
  }, [alerts.length, activeIndex])

  if (loading) {
    return (
      <div className="space-y-3">
        <WeatherAlertSkeleton />
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="w-9 h-9 rounded-full bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (alerts.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Tidak ada peringatan cuaca aktif dari BMKG saat ini.
      </p>
    )
  }

  const handlePrev = () => {
    setActiveIndex((prev) => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setActiveIndex((prev) => Math.min(alerts.length - 1, prev + 1))
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <WeatherAlertCard {...alerts[activeIndex]} id={activeIndex} />

        <button
          type="button"
          onClick={handlePrev}
          disabled={activeIndex === 0}
          aria-label="Peringatan cuaca sebelumnya"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-300 bg-white/95 shadow-sm flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeIndex === alerts.length - 1}
          aria-label="Peringatan cuaca berikutnya"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-gray-300 bg-white/95 shadow-sm flex items-center justify-center text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" aria-hidden />
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        {activeIndex + 1} / {alerts.length}
      </p>
    </div>
  )
}

export default WeatherAlertList