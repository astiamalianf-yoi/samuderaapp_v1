import { Bell, BellOff } from "lucide-react"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useProfile } from "../hooks/useAppState"
import type { BeachLocation } from "../types/api"
import { BEACH_LOCATIONS } from "../constants/observationData"

interface PushNotificationCardProps {
  selectedBeach: BeachLocation
}

export function PushNotificationCard({ selectedBeach }: PushNotificationCardProps) {
  const profile = useProfile()
  const { permission, isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications(selectedBeach, profile)

  const beachLabel = BEACH_LOCATIONS.find((b) => b.value === selectedBeach)?.label ?? "pantai ini"

  if (!isSupported) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-4 text-base text-gray-700">
        HP ini belum bisa menerima notifikasi. Gabung grup WhatsApp agar tetap dapat peringatan.
      </div>
    )
  }

  if (isSubscribed) {
    return (
      <div className="rounded-2xl bg-white border border-gray-200 p-4 flex items-center gap-3">
        <span className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <Bell className="w-6 h-6" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold">Notifikasi aktif</p>
          <p className="text-sm text-gray-600">Peringatan untuk {beachLabel}{profile ? ", sesuai profil Anda" : ""}</p>
        </div>
        <button type="button" onClick={unsubscribe} disabled={isLoading}
          className="min-h-11 px-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-300 disabled:opacity-50">
          Matikan
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-sky-50 border-2 border-sky-300 p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-full bg-sky-200 text-sky-900 flex items-center justify-center shrink-0">
          <BellOff className="w-6 h-6" aria-hidden />
        </span>
        <div>
          <p className="font-bold text-lg">Nyalakan notifikasi</p>
          <p className="text-base text-gray-700">Agar HP berbunyi saat ada bahaya di {beachLabel}.</p>
        </div>
      </div>
      <button type="button" onClick={subscribe} disabled={isLoading || permission === "denied"}
        className="mt-3 w-full min-h-12 rounded-xl bg-sky-800 text-white text-lg font-bold disabled:opacity-50">
        {isLoading ? "Memproses..." : "Nyalakan"}
      </button>
      {permission === "denied" && (
        <p className="mt-2 text-sm text-orange-700">Notifikasi diblokir. Buka pengaturan browser untuk mengizinkan.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
