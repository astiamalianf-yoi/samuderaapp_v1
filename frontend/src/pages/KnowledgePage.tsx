import { useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, FlaskConical, Info, Minus } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { EVIDENCE_LABEL, SIGN_SCIENCE, TIER_LABEL, type Evidence, type TrustTier } from "../constants/signs"
import { liveSigns, tierMove, useTrustIndex, type LiveSign } from "../hooks/useTrustIndex"

/**
 * One colour per tier, used on the section header AND on every sign card (left bar + label),
 * so a card still shows its tier after scrolling past the header. Blue / amber / grey on purpose:
 * green and red mean safe and danger in the warnings.
 */
const TIER_INFO: Record<TrustTier, { title: string; text: string; style: string; bar: string; pill: string }> = {
  High: {
    title: "Sangat dipercaya",
    text: "Tanda ini paling sering terbukti benar menurut nelayan. Jika terlihat, segera lakukan tindakan yang dianjurkan.",
    style: "bg-sky-800 text-white",
    bar: "border-l-sky-700",
    pill: "bg-sky-100 text-sky-900",
  },
  Low: {
    title: "Kurang dipercaya",
    text: "Tanda ini kadang benar, kadang tidak. Jangan hanya mengandalkan tanda ini — perhatikan tanda lain dan cek info BMKG.",
    style: "bg-amber-100 text-amber-950 border border-amber-300",
    bar: "border-l-amber-500",
    pill: "bg-amber-100 text-amber-900",
  },
  Unranked: {
    title: "Belum cukup data",
    text: "Tanda ini jarang dilaporkan, sehingga belum bisa dinilai. Tetap laporkan jika Anda melihatnya.",
    style: "bg-slate-100 text-slate-800 border border-slate-300",
    bar: "border-l-slate-400",
    pill: "bg-slate-100 text-slate-700",
  },
}

/** Small arrow: has the sign moved to a higher or lower tier since the survey? */
function MoveIcon({ s }: { s: LiveSign }) {
  if (!s.paperTier) return null
  const move = tierMove(s)
  const text = move === "same" ? `Tetap ${TIER_LABEL[s.tier].toLowerCase()} sejak survei`
    : `${move === "up" ? "Naik" : "Turun"} dari ${TIER_LABEL[s.paperTier].toLowerCase()} sejak survei`
  const Icon = move === "up" ? ArrowUp : move === "down" ? ArrowDown : Minus
  const color = move === "up" ? "text-sky-700" : move === "down" ? "text-amber-700" : "text-gray-400"
  return (
    <span className={`inline-flex items-center ${color}`} title={text} data-move={move}>
      <Icon className="w-4 h-4" strokeWidth={2.5} aria-hidden />
      <span className="sr-only">{text}</span>
    </span>
  )
}

const num = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d })

/** Pengetahuan Nelayan: the local-knowledge signs, grouped by the live Trust Index. */
/** "25 Nov 09.04 WIB" */
const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".") + " WIB"

const EVIDENCE_STYLE: Record<Evidence, string> = {
  didukung: "bg-emerald-50 text-emerald-900 border-emerald-200",
  sebagian: "bg-violet-50 text-violet-900 border-violet-200",
  belum: "bg-gray-50 text-gray-700 border-gray-300",
}

/** Short tier texts for the compact section headers. */
const TIER_SHORT: Record<TrustTier, string> = {
  High: "Paling sering terbukti benar. Jika terlihat, segera lakukan tindakan yang dianjurkan.",
  Low: "Kadang benar, kadang tidak. Perhatikan tanda lain dan cek info BMKG.",
  Unranked: "Jarang dilaporkan, belum bisa dinilai. Tetap laporkan jika Anda melihatnya.",
}

export function KnowledgePage() {
  const [open, setOpen] = useState<string | null>(null)
  const [showUnranked, setShowUnranked] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const trust = useTrustIndex()
  const signs = liveSigns(trust)
  const appReports = trust?.signs.reduce((n, s) => n + s.appReports + (s.appPending ?? 0), 0) ?? 0
  const hours = trust?.confirmWindowHours ?? 24
  return (
    <AppShell title="Tanda Alam">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black">Pengetahuan nelayan</h1>
          <p className="text-base text-gray-700">
            Tanda-tanda angin kencang dari pengalaman nelayan, diurutkan dari yang paling dipercaya. Tekan tanda untuk melihat
            penjelasan ilmiah, tindakan, dan angka kepercayaannya.
          </p>
          <button onClick={() => setShowAbout(!showAbout)} aria-expanded={showAbout}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-sky-800">
            <Info className="w-4 h-4" aria-hidden /> Cara menilai kepercayaan
            <ChevronDown className={`w-4 h-4 transition-transform ${showAbout ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showAbout && (
            <div className="mt-2 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 space-y-2">
              <p>
                Kepercayaan dinilai dari survei 245 nelayan di Aceh, lalu diperbarui dari laporan nelayan di aplikasi dan WhatsApp:
                tanda yang sering dilaporkan langsung dihitung, dan tanda yang dalam {hours} jam diikuti laporan angin kencang dari
                nelayan lain makin dipercaya.
              </p>
              {trust && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Keterangan">
                  <span className="inline-flex items-center gap-1"><ArrowUp className="w-4 h-4 text-sky-700" strokeWidth={2.5} aria-hidden /> naik</span>
                  <span className="inline-flex items-center gap-1"><ArrowDown className="w-4 h-4 text-amber-700" strokeWidth={2.5} aria-hidden /> turun</span>
                  <span className="inline-flex items-center gap-1"><Minus className="w-4 h-4 text-gray-400" strokeWidth={2.5} aria-hidden /> tetap</span>
                  <span>dibanding survei</span>
                </p>
              )}
              <p>
                Penjelasan ilmiah: <b>Didukung sains</b> (sudah dijelaskan penelitian cuaca), <b>Sebagian dijelaskan</b> (ada
                dasar ilmiah, tetapi belum pasti), <b>Belum ada penjelasan ilmiah</b> (dari pengalaman nelayan saja).
              </p>
            </div>
          )}
          {trust?.mode === "adaptive" && appReports > 0 && (
            <p className="text-sm text-gray-500 mt-1">Termasuk {num(appReports)} laporan tanda dari nelayan (aplikasi + WhatsApp).</p>
          )}
        </div>
        {(["High", "Low", "Unranked"] as TrustTier[]).map((tier) => {
          const list = signs.filter((s) => s.tier === tier)
          if (list.length === 0) return null
          const folded = tier === "Unranked" && !showUnranked
          return (
            <section key={tier} className="space-y-2">
              <div className={`rounded-xl px-3 py-2 ${TIER_INFO[tier].style}`}>
                <h2 className="text-lg font-extrabold">{TIER_INFO[tier].title}</h2>
                <p className="text-sm">{TIER_SHORT[tier]} <span className="opacity-80">({list.length} tanda)</span></p>
              </div>
              {folded ? (
                <button onClick={() => setShowUnranked(true)} data-testid="show-unranked"
                  className="w-full rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-left text-base">
                  <span className="mr-1" aria-hidden>{list.map((s) => s.emoji).join(" ")}</span>
                  <span className="block font-semibold text-sky-800 mt-1">Tampilkan {list.length} tanda</span>
                </button>
              ) : (
                <ul className="rounded-xl bg-white border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {list.map((s) => {
                    const isOpen = open === s.code
                    const sci = SIGN_SCIENCE[s.code]
                    return (
                      <li key={s.code}>
                        <button onClick={() => setOpen(isOpen ? null : s.code)} aria-expanded={isOpen}
                          className={`w-full text-left border-l-[5px] ${TIER_INFO[s.tier].bar} px-3 py-2.5 flex gap-3 items-center ${isOpen ? "bg-gray-50" : ""}`}>
                          <span className="text-3xl w-9 text-center shrink-0" aria-hidden>{s.emoji}</span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-base font-bold">{s.short}</span>
                              <MoveIcon s={s} />
                            </span>
                            <span className={`block text-sm text-gray-600 ${isOpen ? "" : "truncate"}`}>{s.description}</span>
                          </span>
                          <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-3 pt-1 bg-gray-50 space-y-2 text-sm" data-testid="sign-detail">
                            {s.action ? <p className="text-base">Tindakan yang paling sering dilakukan: <b>{s.action}</b>.</p> : null}
                            {sci && (
                              <div className={`rounded-lg border p-2.5 ${EVIDENCE_STYLE[sci.evidence]}`} data-testid="sign-science">
                                <p className="flex items-center gap-1.5 font-semibold">
                                  <FlaskConical className="w-4 h-4" aria-hidden /> Penjelasan ilmiah · {EVIDENCE_LABEL[sci.evidence]}
                                </p>
                                <p className="mt-1 text-gray-800">{sci.text}</p>
                                {sci.source && <p className="mt-1 text-xs text-gray-500">Sumber: {sci.source}</p>}
                              </div>
                            )}
                            {s.trust && (
                              <p className="text-gray-600">
                                Indeks kepercayaan {num(s.trust.trustIndex, 1)} · terbukti {num(s.trust.accuracy)}% ·{" "}
                                {num(s.trust.surveyRecords)} dari survei
                                {s.trust.appReports + (s.trust.appPending ?? 0) > 0 && (
                                  <>
                                    , {num(s.trust.appReports + (s.trust.appPending ?? 0))} laporan nelayan (aplikasi + WhatsApp)
                                    {s.trust.appReports > 0 && <>: {num(s.trust.appConfirmed)} dari {num(s.trust.appReports)} diikuti angin kencang</>}
                                    {(s.trust.appPending ?? 0) > 0 && (
                                      <span className="block" data-testid="trust-pending">
                                        {num(s.trust.appPending ?? 0)} laporan masih menunggu {hours} jam untuk dinilai
                                        {s.trust.appPendingUntil && <> (mulai {waktu(s.trust.appPendingUntil)})</>}; sudah dihitung sebagai pemakaian tanda.
                                      </span>
                                    )}
                                  </>
                                )}
                              </p>
                            )}
                            <p className="text-gray-500">({TIER_LABEL[s.tier]} · {s.code})</p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </AppShell>
  )
}
