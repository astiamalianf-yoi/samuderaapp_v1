import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, RefreshCw, UserRound } from "lucide-react"
import type { BeachLocation } from "../types/api"
import { useActiveWarning, usePersonalWarning, useProfile, useRegistration } from "../hooks/useAppState"
import { LEVELS, STRATEGY_HEADLINE, assessBmkg, eventLevel, fuseLevels, mainAction, maxLevel, toLevel } from "../lib/warning"
import type { BmkgData } from "../services/reportService"
import type { WeatherAlertProps } from "./WeatherAlertCard"
import { getSign } from "../constants/signs"
import { WhyPanel } from "./WhyPanel"
import { BEACH_LOCATIONS } from "../constants/observationData"

const ACK_KEY = "samudra_acked_alerts"

const timeAgo = (ts?: number | null) => {
  if (!ts) return ""
  const min = Math.round((Date.now() - ts) / 60000)
  if (min < 1) return "baru saja"
  if (min < 60) return `${min} menit lalu`
  return `${Math.round(min / 60)} jam lalu`
}

/** The single most important thing on the home screen: is it safe to go to sea? */
export function WarningStatusCard({ beach, bmkg = null, weatherAlerts = [] }: {
  beach: BeachLocation
  bmkg?: BmkgData | null
  weatherAlerts?: WeatherAlertProps[]
}) {
  const { data, loading, error, updatedAt, refresh } = useActiveWarning(beach)
  const profile = useProfile()
  const registration = useRegistration()
  const active = data?.active_warning
  const event = active?.alertEvent
  const distributed = event?.decision?.shouldDistribute ?? !!active
  const personal = usePersonalWarning(beach, profile, distributed ? active?.alertId : undefined)
  const bmkgState = assessBmkg(bmkg, weatherAlerts)
  const beachLabel = BEACH_LOCATIONS.find((b) => b.value === beach)?.label ?? beach
  const [open, setOpen] = useState(false)
  const [acked, setAcked] = useState(false)

  useEffect(() => {
    setOpen(false)
    try {
      const list = JSON.parse(localStorage.getItem(ACK_KEY) || "[]") as string[]
      setAcked(!!active?.alertId && list.includes(active.alertId))
    } catch {
      setAcked(false)
    }
  }, [active?.alertId])

  const acknowledge = () => {
    if (!active?.alertId) return
    try {
      const list = JSON.parse(localStorage.getItem(ACK_KEY) || "[]") as string[]
      localStorage.setItem(ACK_KEY, JSON.stringify([...list, active.alertId].slice(-30)))
    } catch {
      // ignore
    }
    setAcked(true)
  }

  if (loading && !data) {
    return <div className="h-48 rounded-3xl bg-gray-200 animate-pulse" aria-label="Memuat status" />
  }

  if (error && !data) {
    return (
      <div className="rounded-3xl border-2 border-gray-300 bg-white p-5 text-gray-900">
        <p className="text-lg font-bold">Status belum bisa dimuat</p>
        <p className="mt-1">Periksa sinyal internet, lalu coba lagi.</p>
        <button onClick={() => refresh()} className="mt-4 min-h-12 px-5 rounded-xl bg-sky-800 text-white font-bold">Coba lagi</button>
      </div>
    )
  }

  // ---- No community warning: the BMKG side alone decides (fusion = max of both).
  if (!active || !distributed) {
    const counts = Object.entries(data?.counts ?? {})
    const pending = counts.length > 0 && (
      <p className="mt-3 text-base">
        Laporan masuk: {counts.map(([c, v]) => `${getSign(c)?.short ?? c} (${v.count})`).join(", ")}.
        {(data?.threshold ?? 1) > 1 && <>{" "}Peringatan keluar jika {data?.threshold} nelayan melaporkan tanda yang sama.</>}
      </p>
    )

    if (bmkgState.level === "NORMAL") {
      const s = LEVELS.NORMAL
      return (
        <section className={`rounded-3xl border-2 p-5 ${s.card}`} aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">Status laut hari ini · {beachLabel}</p>
          <p className="text-4xl font-black mt-1">{s.emoji} {s.label}</p>
          <p className="text-lg mt-1">Tidak ada peringatan dari nelayan maupun BMKG untuk pantai ini.</p>
          {pending}
          <Footer updatedAt={updatedAt} loading={loading} onRefresh={() => refresh()} />
        </section>
      )
    }

    const s = LEVELS[bmkgState.level]
    const w = bmkgState.warnings[0]
    return (
      <section className={`rounded-3xl border-2 p-5 shadow-lg ${s.card}`} role="alert">
        <p className="text-sm font-semibold uppercase tracking-wide opacity-90">Peringatan dari BMKG · {beachLabel}</p>
        <p className="text-5xl font-black mt-1 leading-none">{s.emoji} {s.label}</p>
        <p className="text-lg font-semibold mt-2">{s.sub}</p>
        <div className="mt-4 rounded-2xl bg-white text-gray-950 p-4 shadow">
          <p className="text-xl font-extrabold">{w ? w.condition : "Cuaca kurang baik"}</p>
          {bmkgState.level === "SIAGA"
            ? <p className="text-lg mt-1">👉 <b>Tunda melaut{w ? ` sampai pukul ${w.end}` : ""}</b></p>
            : <p className="text-lg mt-1">👉 <b>Hati-hati, cek cuaca lagi sebelum melaut</b></p>}
          <ul className="mt-2 text-base list-disc pl-5">
            {bmkgState.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <p className="mt-3 text-base">Belum ada laporan tanda alam dari nelayan. Jika Anda melihat tanda alam, segera lapor.</p>
        {pending}
        <Footer updatedAt={updatedAt} loading={loading} onRefresh={() => refresh()} />
      </section>
    )
  }

  // ---- Active warning
  // Fishermen's side: the personal strategy level, or the level of the community warning.
  const likLevel = maxLevel(
    personal?.lik_risk_level ? toLevel(personal.lik_risk_level) : "NORMAL",
    event?.ml?.lik_risk_level ? toLevel(event.ml.lik_risk_level) : "NORMAL",
  )
  const level = maxLevel(eventLevel(event), fuseLevels(likLevel, bmkgState.level))
  const s = LEVELS[level === "NORMAL" ? "WASPADA" : level]
  const strategy = personal?.warning_strategy ?? event?.ml?.warning_strategy ?? null
  const head = strategy ? STRATEGY_HEADLINE[strategy.code] : null
  const action = mainAction(event)
  const codes = event?.ml?.active_warning ?? active.codes ?? []

  return (
    <section className={`rounded-3xl border-2 p-5 shadow-lg ${s.card}`} role="alert">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide opacity-90">
          {bmkgState.level !== "NORMAL" ? "Peringatan dari nelayan dan BMKG" : "Peringatan dari nelayan"} · {beachLabel}
        </p>
        {personal?.warning_strategy && (
          <span className={`flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1 ${s.badge}`}>
            <UserRound className="w-3.5 h-3.5" /> Untuk Anda
          </span>
        )}
      </div>
      <p className="text-5xl font-black mt-1 leading-none">{s.emoji} {s.label}</p>
      <p className="text-lg font-semibold mt-2">{s.sub}</p>

      {head && (
        <div className="mt-4 rounded-2xl bg-white text-gray-950 p-4 shadow">
          <p className="text-xl font-extrabold">{head.title}</p>
          {action && <p className="text-lg mt-1">👉 <b>{action}</b></p>}
          <p className="text-base mt-1">{head.action}</p>
        </div>
      )}
      {!head && event?.ml?.action_recommendation && (
        <div className="mt-4 rounded-2xl bg-white text-gray-950 p-4 shadow text-lg">{event.ml.action_recommendation}</div>
      )}

      <div className="mt-4">
        <p className="font-bold">Tanda yang dilihat nelayan</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {codes.map((c) => {
            const sign = getSign(c)
            const n = data?.counts?.[c.toUpperCase()]?.count ?? data?.counts?.[c]?.count
            return (
              <li key={c} className="flex items-center gap-2 rounded-full bg-white/80 text-gray-950 px-3 py-2 text-base border border-black/10">
                <span aria-hidden>{sign?.emoji}</span>
                <span className="font-semibold">{sign?.short ?? c}</span>
                {n ? <span className="text-sm opacity-70">· {n} laporan</span> : null}
              </li>
            )
          })}
        </ul>
        {active.triggeredAt && (
          <p className="mt-2 text-sm opacity-80">
            Dimulai {timeAgo(active.triggeredAt)}
            {active.expiresAt ? ` · berlaku sampai ${new Date(active.expiresAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB` : ""}
          </p>
        )}
      </div>

      {level === "EKSTREM" && (
        <p className="mt-4 rounded-xl bg-white text-red-800 p-3 text-base font-bold border-2 border-red-700">
          🛑 Nelayan dan BMKG sama-sama memberi peringatan bahaya. Jangan melaut.
        </p>
      )}
      {bmkgState.warnings.length > 0 && (
        <p className="mt-4 rounded-xl bg-white/80 text-gray-950 p-3 text-base border border-red-300">
          ⚠️ BMKG juga mengeluarkan peringatan: <b>{bmkgState.warnings[0].condition}</b> sampai pukul {bmkgState.warnings[0].end}.
        </p>
      )}

      {!profile && (
        <Link to="/profil" className="mt-4 flex items-center gap-2 rounded-xl bg-white/80 text-sky-900 px-4 py-3 font-semibold border border-sky-200">
          <UserRound className="w-5 h-5" /> Isi profil singkat agar peringatan sesuai untuk Anda
        </Link>
      )}

      {event && (
        <div className="mt-4">
          <button onClick={() => setOpen(!open)} aria-expanded={open}
            className="w-full min-h-12 flex items-center justify-between rounded-xl bg-white/60 text-gray-950 px-4 font-bold">
            Mengapa ada peringatan ini?
            <ChevronDown className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <div className="mt-3 rounded-2xl bg-white/80 text-gray-950 p-4"><WhyPanel event={event} personal={personal} token={registration?.token ?? null} /></div>}
        </div>
      )}

      {(level === "SIAGA" || level === "EKSTREM") && (
        <button onClick={acknowledge} disabled={acked}
          className="mt-4 w-full min-h-14 rounded-xl bg-gray-950 text-white text-lg font-bold disabled:opacity-60">
          {acked ? "✓ Sudah dibaca" : "Saya mengerti"}
        </button>
      )}
      <Footer updatedAt={updatedAt} loading={loading} onRefresh={() => refresh()} />
    </section>
  )
}

function Footer({ updatedAt, loading, onRefresh }: { updatedAt: number | null; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm opacity-80">
      <span>{updatedAt ? `Diperbarui ${timeAgo(updatedAt)}` : ""}</span>
      <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1 min-h-10 px-2 font-semibold">
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Perbarui
      </button>
    </div>
  )
}
