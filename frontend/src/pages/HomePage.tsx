import { Link } from "react-router-dom"
import { ArrowRight, Megaphone } from "lucide-react"
import { AppShell, WhatsAppGroupCard } from "../components/layout/AppShell"
import { BeachPicker } from "../components/BeachPicker"
import { WarningStatusCard } from "../components/WarningStatusCard"
import { BmkgMarineCard } from "../components/BmkgMarineCard"
import { PushNotificationCard } from "../components/PushNotificationCard"
import { WeatherAlertList } from "../components/WeatherAlertList"
import { useBmkg, useSelectedBeach } from "../hooks/useAppState"
import { useWeatherAlerts } from "../hooks/useWeatherAlerts"

export function HomePage() {
  const [beach, setBeach] = useSelectedBeach()
  const weather = useWeatherAlerts(beach)
  const bmkg = useBmkg(beach)

  return (
    <AppShell>
      <div className="space-y-5">
        <BeachPicker value={beach} onChange={setBeach} />

        <WarningStatusCard beach={beach} bmkg={bmkg} weatherAlerts={weather.alerts} />

        <Link to="/lapor"
          className="flex items-center gap-4 rounded-2xl bg-orange-600 text-white p-4 shadow-md active:scale-[0.99]">
          <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Megaphone className="w-7 h-7" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-xl font-extrabold">Lihat tanda alam?</span>
            <span className="block text-base">Lapor sekarang, cukup 2 sentuhan</span>
          </span>
          <ArrowRight className="w-6 h-6" aria-hidden />
        </Link>

        <PushNotificationCard selectedBeach={beach} />

        <WhatsAppGroupCard />

        <BmkgMarineCard data={bmkg} alerts={weather.alerts} />

        <section className="space-y-3">
          <h2 className="text-xl font-extrabold">Peringatan cuaca BMKG</h2>
          <WeatherAlertList selectedBeach={beach} state={weather} />
        </section>

      </div>
    </AppShell>
  )
}
