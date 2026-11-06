import { useState } from "react"
import { MainLayout } from "../components/layout/MainLayout"
import { ArrowRight, MapPin, Plus } from "lucide-react"
import { TodayForecast } from "../components/TodayForecast"
import { WeatherAlertList } from "../components/WeatherAlertList"
import { ReportBottomSheet } from "../components/ReportBottomSheet"
import { FishermanReportList } from "../components/FishermanReportList"
import { PushNotificationCard } from "../components/PushNotificationCard"
import { BEACH_LOCATIONS, getBeachMeta } from "../constants/observationData"
import type { BeachLocation } from "../types/api"

export function HomePage() {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedBeach, setSelectedBeach] = useState<BeachLocation>("pantai_depok");
  const [disableFilter, setDisableFilter] = useState(() => {
    return localStorage.getItem("dev_disable_filter") === "true";
  });

  const handleToggleFilter = (checked: boolean) => {
    setDisableFilter(checked);
    localStorage.setItem("dev_disable_filter", checked.toString());
  };
  const selectedBeachLabel =
    BEACH_LOCATIONS.find((beach) => beach.value === selectedBeach)?.label ??
    "Pilih Pantai";
  const selectedBeachMeta = getBeachMeta(selectedBeach)

  return (
    <MainLayout>
      <div className="space-y-3">
        {/* Floating Action Button for Report - Tanda Alam */}
        <button
          onClick={() => setIsReportOpen(true)}
          aria-label="Lapor Tanda Alam"
          className="fixed right-6 flex items-center gap-2 px-5 py-4 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-300 z-30 font-medium hw-accelerate touch-optimize"
          style={{
            bottom: 'calc(1.5rem + var(--safe-area-inset-bottom))',
            transition: 'transform 0.15s ease-out, background-color 0.2s',
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)'
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          <span>Lapor Tanda</span>
        </button>

        <div className="space-y-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" aria-hidden />
            {selectedBeachLabel}
          </h1>
          <div className="relative">
            <select
              value={selectedBeach}
              onChange={(event) => setSelectedBeach(event.target.value as BeachLocation)}
              className="w-full bg-white rounded-lg border border-black text-sm py-2 pl-3 pr-3 focus:outline-none"
              aria-label="Pilih lokasi pantai"
            >
              {BEACH_LOCATIONS.map((beach) => (
                <option key={beach.value} value={beach.value}>
                  {beach.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <PushNotificationCard selectedBeach={selectedBeach} />

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">Peringatan Cuaca</h1>
          {import.meta.env.DEV && (
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input 
                type="checkbox" 
                checked={disableFilter} 
                onChange={(e) => handleToggleFilter(e.target.checked)} 
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Semua Lokasi
            </label>
          )}
        </div>
        <WeatherAlertList selectedBeach={selectedBeach} disableFilter={disableFilter} />

        <div className="space-y-3">
          <div className="flex items-center justify-between mt-5">
            <h1 className="text-xl font-bold flex items-center gap-2">Prakiraan Cuaca</h1>
            <a href="/forecast" className="text-sm text-primary hover:underline font-semibold flex items-center gap-2">
              Per Jam
              <span className="w-5 h-5 flex items-center justify-center bg-primary text-white rounded-full">
                <ArrowRight className="w-3 h-3" aria-hidden strokeWidth={4} />
              </span>
            </a>
          </div>
          <TodayForecast adm4Code={selectedBeachMeta?.adm4Code} />
        </div>

        <div className="space-y-3">
          <h1 className="text-xl font-bold flex items-center gap-2 mt-5">Profil Komunitas</h1>
          <FishermanReportList selectedBeach={selectedBeach} />
        </div>
      </div>

      <ReportBottomSheet
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        beachLocation={selectedBeach}
      />
    </MainLayout>
  )
}
