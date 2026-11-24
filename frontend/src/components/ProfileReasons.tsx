import { ArrowDown, ArrowUp } from "lucide-react"
import type { ProfileView } from "../services/fishermenService"

import { ANSWER_TEXT, num, tippingText } from "../lib/profileText"
import { getSign } from "../constants/signs"

const pct = (v: number) => `${Math.round(v * 100)}%`
/** SHAP on P(mendukung) in probability points, e.g. +0.098 -> "+9,8 poin". */
const points = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} poin`

/**
 * The five answers that moved his result most (top five, as in Paper 2). Each row: rank, the answer
 * and his value, the direction, how much it moved his chance of "mendukung" (SHAP in probability
 * points; % = share of the largest), and a two-sided bar around the tipping-point line (left = to
 * "perlu perhatian", right = to "mendukung") with the tipping point of Paper 2 Table 8.
 * Below: the exact rule behind the colour (how many signs reach the model threshold).
 */
export function TopReasons({ view, title = "Yang paling memengaruhi hasil Anda:" }: { view: ProfileView; title?: string }) {
  const byKey = Object.fromEntries((view.answers ?? []).map((a) => [a.key, a]))
  const top = (view.top ?? []).filter((t) => byKey[t.key])
  if (top.length === 0) return null
  const max = Math.max(...top.map((t) => Math.abs(t.contribution ?? 0)), 0)
  const s = view.summary
  return (
    <>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <ol className="space-y-2" data-testid="profile-top">
        {top.map((t, i) => {
          const a = byKey[t.key]
          const up = t.push === "up"
          const c = t.contribution
          const share = c != null && max > 0 ? Math.abs(c) / max : null
          const tp = tippingText(t.key)
          return (
            <li key={t.key} className="rounded-xl bg-white border border-gray-200 p-3 space-y-2" data-push={t.push}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center justify-center" aria-hidden>{i + 1}</span>
                <span className="flex-1 min-w-0 text-base text-gray-800 leading-snug">{ANSWER_TEXT[t.key]?.label ?? t.key}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pl-8">
                <span className="text-base font-bold text-gray-900">{ANSWER_TEXT[t.key]?.show(a) ?? num(a.value)}</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${up ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}`} data-testid="profile-contribution">
                  {up ? <ArrowUp className="w-3.5 h-3.5" aria-hidden /> : <ArrowDown className="w-3.5 h-3.5" aria-hidden />}
                  <span className="sr-only">{up ? "mendorong ke mendukung:" : "mendorong ke perlu perhatian:"}</span>
                  {c != null && share != null ? <>{points(c)} ({pct(share)})</> : up ? "mendukung" : "perlu perhatian"}
                </span>
              </div>
              {share != null && (
                <div aria-hidden>
                  <div className="relative h-3">
                    <div className="absolute inset-y-1 left-0 right-0 rounded-full bg-gray-100" />
                    <div className={`absolute inset-y-1 rounded-full ${up ? "bg-teal-500 left-1/2" : "bg-amber-500 right-1/2"}`} style={{ width: `${Math.max(3, share * 50)}%` }} />
                    <div className="absolute inset-y-0 left-1/2 w-0.5 -ml-px bg-gray-800" />
                  </div>
                  <div className="mt-0.5 grid grid-cols-3 text-[11px] leading-tight text-gray-600">
                    <span>← perlu perhatian</span>
                    <span className="text-center font-semibold text-gray-800">{tp ? <>titik balik {tp.point}</> : "titik balik"}</span>
                    <span className="text-right">mendukung →</span>
                  </div>
                </div>
              )}
              {tp && (
                <p className="text-xs text-gray-600" data-testid="profile-tipping">
                  {tp.unsafe}: perlu perhatian · {tp.safe}: mendukung
                </p>
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-gray-600 leading-relaxed">
        Poin = berapa jawaban ini menaikkan (↑) atau menurunkan (↓) peluang Anda masuk “mendukung”; persen dibanding pengaruh terbesar (100%).
        Titik balik = nilai jawaban tempat pengaruhnya biasanya berubah arah, dari data 245 nelayan Aceh.
      </p>
      {s && s.signsTotal > 0 && <SignSummary s={s} />}
    </>
  )
}

/**
 * The exact rule behind the colour: his chance of "mendukung" against the model threshold (60%),
 * and per sign which ones reach it (majority of the signs decides).
 */
function SignSummary({ s }: { s: NonNullable<ProfileView["summary"]> }) {
  const need = Math.ceil(s.signsTotal / 2)
  const ok = s.signsUp >= need
  return (
    <div className="rounded-xl bg-white/80 border border-gray-200 p-3 space-y-3" data-testid="profile-summary">
      <p className="text-sm text-gray-800 leading-relaxed">
        {s.mean != null && <>Peluang Anda masuk “mendukung”: <b>{pct(s.mean)}</b> (perlu {pct(s.threshold)}). </>}
        <b>{s.signsUp} dari {s.signsTotal} tanda alam</b> mencapai {pct(s.threshold)};{" "}
        {ok ? <>cukup, karena perlu setidaknya {need}, jadi hasilnya “mendukung”.</> : <>perlu setidaknya {need} agar hasilnya “mendukung”.</>}
      </p>
      {s.perSign && s.perSign.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Peluang Anda untuk tiap tanda alam</p>
          <ul className="space-y-1.5" data-testid="profile-signs">
            {s.perSign.map(({ code, p }) => {
              const up = p >= s.threshold
              return (
                <li key={code} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-2 text-xs" data-up={up}>
                  <span className="truncate text-gray-700" title={getSign(code)?.short ?? code}>{getSign(code)?.short ?? code}</span>
                  <span className="relative h-3 rounded-full bg-gray-100" aria-hidden>
                    <span className={`absolute inset-y-0 left-0 rounded-full ${up ? "bg-teal-500" : "bg-amber-500"}`} style={{ width: `${Math.max(2, p * 100)}%` }} />
                    <span className="absolute -inset-y-0.5 w-0.5 bg-gray-800" style={{ left: `${s.threshold * 100}%` }} />
                  </span>
                  <span className={`text-right font-bold ${up ? "text-teal-700" : "text-amber-700"}`}>{pct(p)}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-1.5 text-[11px] text-gray-600">Garis hitam = {pct(s.threshold)}. Hijau: mencapai {pct(s.threshold)} · oranye: belum.</p>
        </div>
      )}
    </div>
  )
}
