import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import type { ActiveWarningEvent, PersonalWarningResponse } from "../types/api"
import { fishermenService, type ProfileView } from "../services/fishermenService"
import { TopReasons } from "./ProfileReasons"
import { getSign, TIER_LABEL } from "../constants/signs"
import { getBeachMeta } from "../constants/observationData"
import type { BeachLocation } from "../types/api"

const STATUS_TEXT: Record<string, string> = {
  Safe: "Aman",
  Unsafe: "Perlu perhatian",
}

/** BMKG and fused levels as the app names them (the backend logs LOW / MEDIUM / HIGH). */
const LEVEL_WORD: Record<string, string> = {
  LOW: "AMAN", NORMAL: "AMAN", MEDIUM: "WASPADA", WASPADA: "WASPADA", HIGH: "SIAGA", SIAGA: "SIAGA", EKSTREM: "BAHAYA", BAHAYA: "BAHAYA",
}
const levelWord = (v: unknown) => LEVEL_WORD[String(v ?? "").toUpperCase()] ?? String(v ?? "")

/**
 * "Mengapa peringatan ini?" — signs and their trust, how the warning was chosen, BMKG cross-check.
 * When the card shows his personal warning ("Untuk Anda"), the panel explains that one: his strategy
 * and the answers that matter most in his profile (as on Profil), not the beach's survey profile,
 * so card and explanation never disagree (UAT 14 Nov 2026). Otherwise: the beach warning.
 */
export function WhyPanel({ event, personal = null, token = null }: {
  event: ActiveWarningEvent
  personal?: PersonalWarningResponse | null
  token?: string | null
}) {
  const signs = event.ml?.signs ?? []
  const isPersonal = Boolean(personal?.warning_strategy)
  const contributions = isPersonal ? [] : event.ml?.explanation?.contributions ?? []
  const profile = isPersonal ? undefined : event.ml?.explanation?.community_profile
  const re = event.reassurance
  const strategy = personal?.warning_strategy ?? event.ml?.warning_strategy
  const [view, setView] = useState<ProfileView | null>(null)
  useEffect(() => {
    if (!isPersonal || !token) return
    let cancelled = false
    fishermenService.me(token).then((r) => { if (!cancelled) setView(r.profile_view ?? null) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [isPersonal, token])

  return (
    <div className="space-y-5 text-base">
      {!isPersonal && event.ml?.explanation?.summary_id && <p className="leading-relaxed">{event.ml.explanation.summary_id}</p>}

      {signs.length > 0 && (
        <section>
          <h4 className="font-bold mb-2">Tanda yang dilaporkan</h4>
          <ul className="space-y-2">
            {signs.map((s) => {
              const sign = getSign(s.code)
              const tier = s.ranked ? s.trust_tier : "Unranked"
              return (
                <li key={s.code} className="flex items-start gap-3 bg-white/70 rounded-xl p-3 border border-black/10">
                  <span className="text-2xl" aria-hidden>{sign?.emoji ?? "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{sign?.short ?? s.code}</p>
                    <span className={`inline-block mt-1 text-xs font-bold rounded-full px-2 py-0.5 ${
                      tier === "High" ? "bg-sky-700 text-white" : "bg-gray-200 text-gray-800"}`}>
                      {TIER_LABEL[tier]}
                    </span>
                    <p className="text-sm opacity-80 mt-1">{sign?.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {strategy && (
        <section className="bg-white/70 rounded-xl p-3 border border-black/10">
          <h4 className="font-bold mb-1">Cara peringatan dipilih</h4>
          {isPersonal ? (
            <p className="text-sm leading-relaxed">
              Tanda: <b>{strategy.trust_tier === "High" ? "sangat dipercaya" : "kurang dipercaya"}</b>. Untuk tanda ini, profil Anda:{" "}
              <b>{strategy.behavioral_class === 1 ? "mendukung" : "perlu perhatian"}</b>. Maka peringatan untuk Anda: <b>{strategy.label_id}</b>.
            </p>
          ) : (
            <p className="text-sm leading-relaxed">
              Tanda: <b>{strategy.trust_tier === "High" ? "sangat dipercaya" : "kurang dipercaya"}</b>. Kebiasaan bertindak{" "}
              {strategy.behavioral_source === "community_majority" ? "sebagian besar nelayan terdaftar di pantai ini" : "komunitas pantai ini"}:{" "}
              <b>{strategy.behavioral_class === 1 ? "biasanya bertindak" : "sering tidak bertindak"}</b>. Maka peringatan: <b>{strategy.label_id}</b>.
            </p>
          )}
        </section>
      )}

      {isPersonal && (
        <section className="space-y-2" data-testid="why-personal">
          {view && <TopReasons view={view} title="Yang paling memengaruhi profil Anda:" />}
          <Link to="/profil" className="inline-block text-sm font-semibold text-sky-800 underline">Lihat profil Anda</Link>
        </section>
      )}

      {contributions.length > 0 && (
        <section>
          <h4 className="font-bold mb-2">Faktor paling berpengaruh</h4>
          <ul className="space-y-2">
            {contributions.slice(0, 5).map((c) => (
              <li key={c.factor}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{c.label_id}</span>
                  <span className="font-semibold">{Math.round(c.weight * 100)}%</span>
                </div>
                <div className="h-3 rounded-full bg-black/10 overflow-hidden">
                  <div className={`h-full ${c.category === "natural_sign" ? "bg-sky-700" : "bg-violet-600"}`}
                    style={{ width: `${Math.max(4, Math.round(c.weight * 100))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {profile && (
        <section>
          <h4 className="font-bold mb-2">Kebiasaan nelayan {getBeachMeta(profile.beach as BeachLocation)?.label ?? profile.beach}</h4>
          <ul className="divide-y divide-black/10 bg-white/70 rounded-xl border border-black/10">
            {profile.factors.map((f) => (
              <li key={f.key} className="flex justify-between gap-3 p-3 text-sm">
                <span>{f.label_id}</span>
                <span className={`font-semibold ${f.status === "Unsafe" ? "text-red-700" : "text-emerald-700"}`}>
                  {STATUS_TEXT[f.status] ?? f.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {re && (
        <section>
          <h4 className="font-bold mb-2">Dicek dengan BMKG</h4>
          <div className={`rounded-xl border p-3 ${re.agreed ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"} text-gray-900`}>
            <p className="flex items-center gap-2 font-semibold">
              {re.agreed ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <AlertTriangle className="w-5 h-5 text-amber-700" />}
              {String(re.finalLevel).toUpperCase() === "EKSTREM"
                ? "Tanda alam dan BMKG sama-sama menunjukkan bahaya — level dinaikkan menjadi BAHAYA"
                : re.agreed ? "Tanda alam dan BMKG sejalan" : "Tanda alam dan BMKG berbeda — level tertinggi dipakai"}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center mt-3 text-sm">
              <div><p className="opacity-70">Tanda alam</p><p className="font-bold">{levelWord(re.shapRisk)}</p></div>
              <div><p className="opacity-70">BMKG</p><p className="font-bold">{levelWord(re.bmkgRisk)}</p></div>
              <div><p className="opacity-70">Hasil</p><p className="font-bold">{levelWord(re.finalLevel)}</p></div>
            </div>
            {re.details?.weather && (
              <p className="mt-2 text-sm opacity-80">
                {re.details.weather.waveHeight != null && <>Ombak {re.details.weather.waveHeight} m · </>}
                {re.details.weather.windSpeed != null && <>Angin {re.details.weather.windSpeed} km/jam</>}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
