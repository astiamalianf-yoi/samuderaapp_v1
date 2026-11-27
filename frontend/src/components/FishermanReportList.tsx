import { useCallback, useEffect, useState } from "react"
import { RefreshCw, AlertTriangle, ShieldAlert, Info, AlertCircle, Siren, X, ChevronDown, CheckCircle2 } from "lucide-react"
import { reportService } from "../services/reportService"
import { BEACH_LOCATIONS } from "../constants/observationData"
import type { BeachLocation, ActiveReportResponse } from "../types/api"
import { OBSERVATION_OPTIONS } from "../constants/reportConstants"

interface FishermanReportListProps {
  selectedBeach: BeachLocation
}

// Helper to format timestamp
const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return "-"
  return new Date(timestamp).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getEscalationConfig = (level: number) => {
  switch (level) {
    case 4:
      return {
        cardClass: "bg-gradient-to-br from-red-600 to-rose-700 border border-red-500 shadow-xl shadow-red-900/20",
        headerClass: "text-white",
        subHeaderClass: "text-red-100",
        badgeClass: "bg-red-950/30 text-red-50 border border-red-500/30 backdrop-blur-sm",
        Icon: Siren,
        iconClass: "w-6 h-6 animate-pulse drop-shadow-sm",
        iconContainerClass: "bg-white text-red-600 shadow-md ring-4 ring-red-500/30",
        isSticky: true,
        actionClass: "mt-5 p-4 bg-white rounded-xl shadow-lg ring-1 ring-black/5 relative overflow-hidden",
        actionTextClass: "font-bold text-red-700 text-base relative z-10",
        listClass: "bg-red-950/20 border-red-500/30 text-white backdrop-blur-sm [&>li::marker]:text-red-300",
        listEmptyClass: "text-red-200",
        listItemTextClass: "font-semibold text-white",
        listItemCountClass: "text-red-200/80 ml-1.5 text-xs",
        badgeText: "Tindakan Segera",
        dismissible: false,
        requiresAcknowledge: true,
      }
    case 3:
      return {
        cardClass: "bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 shadow-md shadow-orange-900/5",
        headerClass: "text-orange-950",
        subHeaderClass: "text-orange-700",
        badgeClass: "bg-orange-100 text-orange-800 border border-orange-200",
        Icon: AlertTriangle,
        iconClass: "w-5 h-5 fill-current",
        iconContainerClass: "bg-gradient-to-b from-orange-400 to-orange-500 text-white shadow-sm ring-4 ring-orange-100",
        isSticky: true,
        actionClass: "mt-4 p-4 bg-white rounded-xl border border-orange-100 shadow-sm",
        actionTextClass: "font-semibold text-orange-900",
        listClass: "bg-white/80 border-orange-100 text-orange-900 [&>li::marker]:text-orange-500",
        listEmptyClass: "text-orange-700",
        listItemTextClass: "font-medium text-orange-900",
        listItemCountClass: "text-orange-600/80 ml-1.5 text-xs",
        badgeText: "Siaga",
        dismissible: false,
        requiresAcknowledge: false,
      }
    case 2:
      return {
        cardClass: "bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-200/60 shadow-sm",
        headerClass: "text-amber-950",
        subHeaderClass: "text-amber-700",
        badgeClass: "bg-amber-100/80 text-amber-800 border border-amber-200/80",
        Icon: AlertCircle,
        iconClass: "w-5 h-5",
        iconContainerClass: "bg-white text-amber-500 shadow-sm ring-4 ring-amber-100",
        isSticky: false,
        actionClass: "mt-4 p-3.5 bg-white rounded-xl border border-amber-100 shadow-sm",
        actionTextClass: "font-medium text-amber-900",
        listClass: "bg-white/60 border-amber-200/50 text-amber-900 [&>li::marker]:text-amber-500",
        listEmptyClass: "text-amber-700",
        listItemTextClass: "font-medium text-amber-900",
        listItemCountClass: "text-amber-600/80 ml-1.5 text-xs",
        badgeText: "Waspada",
        dismissible: false,
        requiresAcknowledge: false,
      }
    case 1:
    default:
      return {
        cardClass: "bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/80 shadow-sm",
        headerClass: "text-blue-950",
        subHeaderClass: "text-blue-600",
        badgeClass: "bg-white/80 text-blue-700 border border-blue-200",
        Icon: Info,
        iconClass: "w-5 h-5",
        iconContainerClass: "bg-white text-blue-500 shadow-sm ring-4 ring-blue-100",
        isSticky: false,
        actionClass: "mt-4 p-3.5 bg-white rounded-xl border border-blue-100 shadow-sm",
        actionTextClass: "font-medium text-blue-900",
        listClass: "bg-white/60 border-blue-100/50 text-blue-900 [&>li::marker]:text-blue-400",
        listEmptyClass: "text-blue-700",
        listItemTextClass: "font-medium text-blue-900",
        listItemCountClass: "text-blue-600/80 ml-1.5 text-xs",
        badgeText: "Informasi",
        dismissible: true,
        requiresAcknowledge: false,
      }
  }
}

export function FishermanReportList({ selectedBeach }: FishermanReportListProps) {
  const [activeReport, setActiveReport] = useState<ActiveReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  const fetchActiveReport = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true)
    }
    setError(null)
    try {
      const response = await reportService.getActiveReports(selectedBeach)
      setActiveReport(response)
      setCachedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status komunitas")
    } finally {
      setIsLoading(false)
    }
  }, [selectedBeach])

  useEffect(() => {
    fetchActiveReport()
    const intervalId = setInterval(() => {
      fetchActiveReport({ silent: true })
    }, 30000)
    return () => clearInterval(intervalId)
  }, [fetchActiveReport])

  // Reset dismissed state if alert ID changes
  useEffect(() => {
    setIsDismissed(false)
  }, [activeReport?.active_warning?.alertId])

  if (isLoading && !activeReport && !error) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        <div className="h-24 bg-gray-100 rounded-2xl border border-gray-200"></div>
      </div>
    )
  }

  // Safe optional chaining to prevent crashes
  const hasReachedThreshold = activeReport?.active_warning?.alertEvent?.decision?.shouldDistribute ?? false;
  const actionRecommendation = activeReport?.active_warning?.alertEvent?.ml?.action_recommendation;
  const signDescription = activeReport?.active_warning?.alertEvent?.ml?.sign_description;
  const escalationLevel = activeReport?.active_warning?.alertEvent?.ml?.escalation_level || 1;

  const hasWarning = activeReport?.active_warning != null;
  const reportCounts = activeReport?.active_warning?.reportCounts ?? {};
  const reportedCodes = Object.keys(reportCounts).filter(code => reportCounts[code] > 0)

  // Mapping codes to labels with counts
  const tandaDenganCount = reportedCodes.map(code => {
    const option = OBSERVATION_OPTIONS.find(
      (item) => item.value.toLowerCase() === code.toLowerCase()
    )
    return {
      label: option?.label ?? code,
      count: reportCounts[code],
      triggered: true // Assume triggered if it's in active_warning reportCounts
    }
  })

  const config = getEscalationConfig(escalationLevel);

  return (
    <div className="space-y-4">
      {/* Header controls for Refresh */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-gray-400">
          {isLoading ? "Memperbarui data..." : (cachedAt ? `Diperbarui: ${formatTimestamp(cachedAt)}` : "Baru saja diperbarui")}
        </span>
        <button
          type="button"
          onClick={() => fetchActiveReport()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-indigo-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && !activeReport ? (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => fetchActiveReport()}
            className="text-sm font-medium text-red-700 hover:underline"
          >
            Coba lagi
          </button>
        </div>
      ) : (!hasWarning || !hasReachedThreshold) ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center bg-gradient-to-b from-green-50/50 to-white rounded-2xl border border-green-100 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center ring-4 ring-green-50">
            <ShieldAlert className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Kondisi Aman</p>
            <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto">Tidak ada peringatan aktif di lokasi ini saat ini.</p>
          </div>
        </div>
      ) : isDismissed ? (
        <div className="flex items-center justify-between bg-white border border-gray-200 shadow-sm rounded-2xl p-4 transition-all hover:border-gray-300">
          <div className="flex items-center gap-3 text-sm text-gray-600 font-medium">
            <div className="p-2 bg-gray-50 rounded-full">
              <ShieldAlert className="w-4 h-4 text-gray-400" />
            </div>
            <span>Peringatan disembunyikan</span>
          </div>
          <button onClick={() => setIsDismissed(false)} className="text-primary text-sm font-semibold hover:underline">
            Lihat
          </button>
        </div>
      ) : (
        <article className={`rounded-2xl p-5 transition-all duration-500 ease-out ${config.cardClass} ${config.isSticky ? 'sticky top-4 z-20' : ''}`}>
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.iconContainerClass}`}>
                <config.Icon className={config.iconClass} aria-hidden />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className={`text-sm font-semibold truncate ${config.headerClass}`}>
                Status {BEACH_LOCATIONS.find(b => b.value === selectedBeach)?.label ?? selectedBeach}
              </h2>
              <p className={`text-xs ${config.subHeaderClass}`}>
                Laporan Aktif
              </p>
            </div>

            {/* Action Badge & Controls */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.badgeClass}`}>
                <config.Icon className="w-3 h-3" aria-hidden />
                {config.badgeText}
              </div>
              {config.dismissible && (
                <button 
                  onClick={() => setIsDismissed(true)}
                  className={`p-1 rounded-md opacity-70 hover:opacity-100 transition-opacity ${config.headerClass}`}
                  aria-label="Tutup Peringatan"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tanda yang Diamati (Counts) */}
          <div className="mt-4">
            <p className="text-sm font-semibold mb-2">Tanda yang Diamati</p>
            {tandaDenganCount.length > 0 ? (
              <ul className={`rounded-md p-3 text-sm list-disc pl-5 space-y-1 border ${config.listClass}`}>
                {tandaDenganCount.map((item, idx) => (
                  <li key={idx}>
                    <span className={item.triggered ? config.listItemTextClass : ""}>{item.label}</span>
                    <span className={config.listItemCountClass}>({item.count} laporan)</span>
                  </li>
                ))}
              </ul>
            ) : signDescription && escalationLevel !== 2 ? (
              <p className={`text-sm border p-3 rounded-md ${config.listClass}`}>
                {signDescription}
              </p>
            ) : (
              <p className={`text-sm ${config.listEmptyClass}`}>
                Belum ada tanda yang tercatat.
              </p>
            )}
          </div>

          {/* Edukasi Sign Description (Level 2) */}
          {signDescription && escalationLevel === 2 && (
            <details className="group mt-3">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold list-none p-2 rounded-md hover:bg-amber-100/50 transition-colors">
                <span>Info Tambahan</span>
                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
              </summary>
              <div className={`mt-2 text-sm p-3 rounded-md border ${config.listClass}`}>
                {signDescription}
              </div>
            </details>
          )}

          {/* Info Tambahan Biasa (Level 1, 3, 4 jika ada tandaDenganCount) */}
          {signDescription && tandaDenganCount.length > 0 && escalationLevel !== 2 && (
            <p className={`mt-3 text-sm opacity-90 ${config.subHeaderClass}`}>
              {signDescription}
            </p>
          )}

          {/* Rekomendasi Aksi */}
          {actionRecommendation && (
            <div className={config.actionClass}>
              <p className="text-xs uppercase tracking-wider font-semibold opacity-80 mb-1">Rekomendasi Aksi</p>
              <div className={`text-sm ${config.actionTextClass}`}>
                {actionRecommendation}
              </div>
            </div>
          )}

          {/* Acknowledge Button (Level 4) */}
          {config.requiresAcknowledge && (
            <button
              onClick={() => setIsDismissed(true)}
              className="mt-4 w-full py-3 px-4 bg-red-800 hover:bg-red-900 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-red-600"
            >
              <CheckCircle2 className="w-5 h-5" />
              Saya Mengerti & Akan Berhati-hati
            </button>
          )}
        </article>
      )}
    </div>
  )
}

export default FishermanReportList
