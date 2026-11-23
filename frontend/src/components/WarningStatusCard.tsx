import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, RefreshCw, UserRound } from "lucide-react"
import type { BeachLocation } from "../types/api"
import { useActiveWarning, usePersonalWarning, useProfile, useRegistration } from "../hooks/useAppState"
import { LEVELS, assessBmkg, eventLevel, fuseLevels, maxLevel, toLevel } from "../lib/warning"
import { buildWarningMessage, strategyTraits } from "../lib/warningMessage"
import type { ReactNode } from "react"
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

  // ---- Agreed wording (23 Nov 2026, Warning Strategy Matrix rows 1–15): the same builder as the
  // WhatsApp group message. Registered fishermen see their own strategy ("Untuk Anda").
  const counts = Object.entries(data?.counts ?? {})
  const pending = (!active || !distributed) && counts.length > 0 && (
    <p className="mt-3 text-base">
      Laporan masuk: {counts.map(([c, v]) => `${getSign(c)?.short ?? c} (${v.count})`).join(", ")}.
      {(data?.threshold ?? 1) > 1 && <>{" "}Peringatan keluar jika {data?.threshold} nelayan melaporkan tanda yang sama.</>}
    </p>
  )
  const forecastLevel = assessBmkg(bmkg, []).level
  const official = bmkgState.warnings[0]
  let level = bmkgState.level
  let lik = null as Parameters<typeof buildWarningMessage>[0]["lik"]
  const strategy = personal?.warning_strategy ?? event?.ml?.warning_strategy ?? null
  if (active && distributed) {
    const communityLevel = eventLevel(event)
    const likLevel = maxLevel(personal?.lik_risk_level ? toLevel(personal.lik_risk_level) : "NORMAL", communityLevel)
    level = fuseLevels(likLevel, bmkgState.level)
    const codes = event?.ml?.active_warning ?? active.codes ?? []
    const traits = strategyTraits(strategy?.code)
    lik = {
      level: likLevel === "NORMAL" ? "WASPADA" : likLevel,
      signs: codes.map((c) => getSign(c)?.short ?? c).join(", "),
      reporters: Math.max(1, Number(event?.reporterCount) || 1),
      highTrust: traits.highTrust,
      inaction: traits.inaction,
      startedAt: active.triggeredAt,
      endsAt: active.expiresAt ?? null,
    }
    if (level === "NORMAL") level = "WASPADA"
  }
  const isPersonal = !!personal?.warning_strategy && !!profile
  const blocks = buildWarningMessage({
    beach: beachLabel,
    final: level,
    lik,
    bmkg: {
      official: official ? { event: official.condition, expires: official.expiresAt ?? null } : null,
      forecastLevel,
      windKmh: bmkg?.windSpeed ?? null,
      weather: bmkg?.weather ?? null,
    },
    channel: "app",
    personal: isPersonal,
  })
  const s = LEVELS[level]
  const [head, ...rest] = blocks

  return (
    <section className={`rounded-3xl border-2 p-5 ${level === "NORMAL" ? "" : "shadow-lg "}${s.card}`} role={level === "NORMAL" ? undefined : "alert"} aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide opacity-90"><Rich text={head[0]} /></p>
        {isPersonal && lik && (
          <span className={`flex items-center gap-1 text-xs font-bold rounded-full px-2 py-1 ${s.badge}`}>
            <UserRound className="w-3.5 h-3.5" /> Untuk Anda
          </span>
        )}
      </div>
      <p className="text-base mt-1">{head[1]}</p>
      <p className="text-2xl font-black mt-1 leading-tight"><Rich text={head[2]} /></p>
      {head.slice(3).map((l) => <p key={l} className="text-base mt-1"><Rich text={l} /></p>)}

      {rest.map((b, i) => b.length > 0 && (
        <div key={i} className={i === 0 && level !== "NORMAL" ? "mt-4 rounded-2xl bg-white text-gray-950 p-4 shadow" : "mt-3"}>
          {b.map((l) => (
            <p key={l} className={`text-base ${l.startsWith("✅") ? "mt-1 pl-1" : "mt-1"}`}><Rich text={l} /></p>
          ))}
        </div>
      ))}
      {pending}

      {active && distributed && event && (
        <div className="mt-4">
          <button onClick={() => setOpen(!open)} aria-expanded={open}
            className="w-full min-h-12 flex items-center justify-between rounded-xl bg-white/60 text-gray-950 px-4 font-bold">
            Mengapa ada peringatan ini?
            <ChevronDown className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && <div className="mt-3 rounded-2xl bg-white/80 text-gray-950 p-4"><WhyPanel event={event} personal={personal} token={registration?.token ?? null} /></div>}
        </div>
      )}

      {active && distributed && (level === "SIAGA" || level === "EKSTREM") && (
        <button onClick={acknowledge} disabled={acked}
          className="mt-4 w-full min-h-14 rounded-xl bg-gray-950 text-white text-lg font-bold disabled:opacity-60">
          {acked ? "✓ Sudah dibaca" : "Saya mengerti"}
        </button>
      )}
      <Footer updatedAt={updatedAt} loading={loading} onRefresh={() => refresh()} />
    </section>
  )
}

/** A message line: **bold** parts; "Lapor", "Kejadian" and the registration line are links. */
function Rich({ text }: { text: string }) {
  if (text.startsWith("Daftar agar dapat peringatan khusus")) {
    return <Link to="/profil" className="font-semibold underline">{text}</Link>
  }
  const parts: ReactNode[] = text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p, i) => {
    if (!p.startsWith("**")) return p
    const t = p.slice(2, -2)
    if (t === "Lapor") return <Link key={i} to="/lapor" className="font-bold underline">Lapor</Link>
    if (t === "Kejadian") return <Link key={i} to="/kejadian" className="font-bold underline">Kejadian</Link>
    return <b key={i}>{t}</b>
  })
  return <>{parts}</>
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
