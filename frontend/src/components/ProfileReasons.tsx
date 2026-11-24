import type { ReactNode } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import type { ProfileView } from "../services/fishermenService"

import { ANSWER_TEXT, num, tippingText } from "../lib/profileText"
import { getSign } from "../constants/signs"

const pct = (v: number) => `${Math.round(v * 100)}%`
/** SHAP on P(mendukung) in probability points, e.g. +0.098 -> "+9,8 poin". */
/** gap to the 60% line in points, e.g. 0.016 -> "1,6 poin" */
const gap = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1).replace(".", ",")} poin`
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
                  <span className="sr-only">{up ? "menaikkan peluang mendukung:" : "menurunkan peluang mendukung:"}</span>
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
        Poin = berapa jawaban ini menaikkan (↑) atau menurunkan (↓) peluang Anda masuk “mendukung”, dihitung dari rata-rata nelayan; persen dibanding pengaruh terbesar (100%). ↑ belum berarti “mendukung”: lihat perhitungan di bawah.
        Titik balik = nilai jawaban tempat pengaruhnya biasanya berubah arah, dari data 245 nelayan Aceh.
      </p>
      {s && s.signsTotal > 0 && <SignSummary s={s} top={top} />}
    </>
  )
}

type Step = { label: string; delta: number; note?: string; parts?: { label: string; delta: number }[] }

/** Short answer names for the waterfall rows (full names are in the list above). */
const SHORT: Record<string, string> = {
  usage_frequency: "Memakai tanda alam", lik_combination_count: "Jumlah tanda alam", usage_duration: "Lama memakai tanda",
  disaster_interaction: "Kejadian angin kencang", disaster_experience_count: "Jenis bencana", age: "Usia",
  fishing_experience: "Lama jadi nelayan", fishing_role: "Peran di perahu", fishing_duration: "Lama sekali melaut",
  head_of_community: "Ketua kelompok",
}

/**
 * The exact rule behind the colour (decided 24 Nov 2026): his average chance of "mendukung" over the
 * 10 ranked signs must reach the model threshold (60%). Shown as a SHAP waterfall that adds up
 * exactly: rata-rata nelayan + his answers + the effect of the signs = his chance; then his chance
 * per sign (used for the warning when that sign is reported).
 */
function SignSummary({ s, top }: { s: NonNullable<ProfileView["summary"]>; top: ProfileView["top"] }) {
  const ok = s.mean != null && s.mean >= s.threshold
  const steps: Step[] = []
  if (s.base != null && s.mean != null) {
    const shown = top.reduce((x, t) => x + (t.contribution ?? 0), 0)
    for (const t of top) if (t.contribution != null) steps.push({ label: SHORT[t.key] ?? ANSWER_TEXT[t.key]?.label ?? t.key, delta: t.contribution })
    if (s.answersTotal != null) {
      const others = s.answersTotal - shown
      const topKeys = new Set(top.map((t) => t.key))
      const parts = Object.entries(s.contributions ?? {}).filter(([k]) => !topKeys.has(k))
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => ({ label: SHORT[k] ?? ANSWER_TEXT[k]?.label ?? k, delta: v }))
      if (Math.abs(others) >= 0.0005) steps.push({ label: `Jawaban lain (${parts.length || "lainnya"})`, delta: others, parts })
      const signs = s.mean - s.base - s.answersTotal
      if (Math.abs(signs) >= 0.0005) steps.push({ label: "Pengaruh tanda alam", delta: signs, note: "Dari tanda-tanda alam itu sendiri, sama untuk semua nelayan; bukan dari jawaban Anda." })
    }
  }
  // scale: zoom to the range that matters, always including the 60% line
  let run = s.base ?? 0
  const pts = [run, s.threshold, s.mean ?? run]
  for (const st of steps) { run += st.delta; pts.push(run) }
  const lo = Math.max(0, Math.floor((Math.min(...pts) - 0.05) * 20) / 20)
  const hi = Math.min(1, Math.ceil((Math.max(...pts) + 0.05) * 20) / 20)
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const w = (a: number, b: number) => `${Math.max(0.8, (Math.abs(b - a) / (hi - lo)) * 100)}%`
  let cur = s.base ?? 0
  return (
    <div className="rounded-xl bg-white/80 border border-gray-200 p-3 space-y-3" data-testid="profile-summary">
      <p className="text-sm text-gray-800 leading-relaxed">
        {s.mean != null && <>Peluang Anda masuk “mendukung”: <b>{pct(s.mean)}</b> (perlu {pct(s.threshold)}), {ok ? <>lebih {gap(s.mean - s.threshold)}</> : <>kurang {gap(s.threshold - s.mean)}</>}, jadi hasilnya <b>{ok ? "“mendukung”" : "“perlu perhatian”"}</b>.</>}
      </p>
      {steps.length > 0 && s.base != null && s.mean != null && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Perhitungan peluang Anda</p>
          <ul className="space-y-1.5" data-testid="profile-waterfall">
            <WRow label="Rata-rata nelayan" text={pct(s.base)} bar={<span className="absolute inset-y-0 rounded bg-gray-400" style={{ left: 0, width: x(s.base) }} />} line={x(s.threshold)} />
            {steps.map((st) => {
              const from = cur; cur += st.delta
              const up = st.delta > 0
              return (
                <WRow key={st.label} label={st.label} text={points(st.delta)} up={up} note={st.note} parts={st.parts}
                  bar={<span className={`absolute inset-y-0 rounded ${up ? "bg-teal-500" : "bg-amber-500"}`} style={{ left: x(Math.min(from, cur)), width: w(from, cur) }} />}
                  line={x(s.threshold)} />
              )
            })}
            <WRow label="Peluang Anda" strong text={pct(s.mean)} up={ok}
              bar={<span className={`absolute inset-y-0 rounded ${ok ? "bg-teal-600" : "bg-amber-600"}`} style={{ left: 0, width: x(s.mean) }} />} line={x(s.threshold)} />
          </ul>
          <p className="mt-1.5 text-[11px] text-gray-600">Mulai dari rata-rata nelayan, tiap jawaban menambah atau mengurangi peluang. Garis hitam = {pct(s.threshold)}: hasilnya “mendukung” bila Peluang Anda mencapai garis ini. Skala {pct(lo)}–{pct(hi)}.</p>
        </div>
      )}
      {s.perSign && s.perSign.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">Peluang Anda untuk tiap tanda alam ({s.signsUp} dari {s.signsTotal} mencapai {pct(s.threshold)})</p>
          <ul className="space-y-1.5" data-testid="profile-signs">
            {s.perSign.map(({ code, p }) => {
              const up = p >= s.threshold
              return (
                <li key={code} className="grid grid-cols-[minmax(0,8rem)_1fr_2.5rem] items-center gap-2 text-xs" data-up={up}>
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
          <p className="mt-1.5 text-[11px] text-gray-600">Rata-rata dari daftar ini = Peluang Anda. Saat ada peringatan, peringatan untuk Anda memakai peluang tanda yang dilaporkan.</p>
        </div>
      )}
    </div>
  )
}

function WRow({ label, text, bar, line, up, strong, note, parts }: { label: string; text: string; bar: ReactNode; line: string; up?: boolean; strong?: boolean; note?: string; parts?: { label: string; delta: number }[] }) {
  const head = (
    <span className="flex items-baseline justify-between gap-2">
      <span className={strong ? "font-bold text-gray-900" : "text-gray-700"}>{parts?.length ? <span className="underline decoration-dotted">{label}</span> : label}</span>
      <span className={`${strong ? "font-bold" : "font-semibold"} ${up === undefined ? "text-gray-700" : up ? "text-teal-700" : "text-amber-700"}`}>{text}</span>
    </span>
  )
  return (
    <li className="text-xs">
      {parts?.length ? (
        <details data-testid="profile-other-answers">
          <summary className="cursor-pointer list-none">{head}</summary>
          <ul className="mt-1 mb-1 ml-3 space-y-0.5 text-[11px] text-gray-600">
            {parts.map((p) => (
              <li key={p.label} className="flex justify-between gap-2"><span>{p.label}</span><span className={p.delta > 0 ? "text-teal-700" : p.delta < 0 ? "text-amber-700" : ""}>{points(p.delta)}</span></li>
            ))}
          </ul>
        </details>
      ) : head}
      <span className="relative mt-0.5 block h-3 rounded bg-gray-50" aria-hidden>
        {bar}
        <span className="absolute -inset-y-0.5 w-0.5 bg-gray-800" style={{ left: line }} />
      </span>
      {note && <span className="mt-0.5 block text-[11px] text-gray-500">{note}</span>}
    </li>
  )
}
