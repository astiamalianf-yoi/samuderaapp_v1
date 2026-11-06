import { Bell, BellOff } from "lucide-react"
import { Card } from "./ui/Card"
import { usePushNotifications } from "../hooks/usePushNotifications"
import type { BeachLocation } from "../types/api"
import { BEACH_LOCATIONS } from "../constants/observationData"

interface PushNotificationCardProps {
  selectedBeach: BeachLocation
}

export function PushNotificationCard({ selectedBeach }: PushNotificationCardProps) {
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications(selectedBeach)

  const selectedBeachLabel =
    BEACH_LOCATIONS.find((beach) => beach.value === selectedBeach)?.label ??
    "Lokasi tidak diketahui"

  if (!isSupported) {
    return (
      <Card>
        <p className="text-sm text-gray-600">
          Perangkat ini belum mendukung notifikasi push.
        </p>
      </Card>
    )
  }

  const isDenied = permission === "denied"
  const statusText = isSubscribed
    ? "Notifikasi aktif"
    : isDenied
      ? "Notifikasi diblokir"
      : "Notifikasi belum aktif"

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            {isSubscribed ? <Bell className="w-5 h-5" aria-hidden /> : <BellOff className="w-5 h-5" aria-hidden />}
          </div>
          <div>
            <p className="text-sm font-semibold">Notifikasi Peringatan</p>
            <p className="text-xs text-gray-500">{statusText}</p>
            <p className="text-xs text-gray-500">Pantai: {selectedBeachLabel}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading || isDenied}
          className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
            isSubscribed
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubscribed ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>

      {isDenied && (
        <p className="mt-3 text-xs text-orange-600">
          Izin notifikasi diblokir di browser. Silakan aktifkan lewat pengaturan perangkat.
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}
    </Card>
  )
}

export default PushNotificationCard
