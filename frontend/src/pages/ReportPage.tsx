import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Send, WifiOff } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BeachPicker } from "../components/BeachPicker"
import { SIGNS, SIGN_GROUPS, type Sign } from "../constants/signs"
import { getBeachMeta } from "../constants/observationData"
import { useSelectedBeach } from "../hooks/useAppState"
import { reportService } from "../services/reportService"

type Result = { kind: "sent" | "queued" | "offline"; count: number } | { kind: "error"; message: string }

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16))

/** Report a sign in two taps: tap the sign(s) you see, tap "Kirim". */
export function ReportPage() {
  const [beach, setBeach] = useSelectedBeach()
  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [showAll, setShowAll] = useState(false)

  const common = useMemo(() => SIGNS.filter((s) => s.tier !== "Unranked"), [])
  const rare = useMemo(() => SIGNS.filter((s) => s.tier === "Unranked"), [])

  const toggle = (code: string) =>
    setSelected((cur) => (cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]))

  const send = async () => {
    if (selected.length === 0) return
    setSending(true)
    const payload = { beach_location: beach, lik_codes: selected, clientReportId: newId(), createdAtClient: Date.now() }
    try {
      await reportService.submitReport(payload)
      setResult({ kind: "sent", count: selected.length })
      setSelected([])
    } catch (err) {
      // Offline: the service worker keeps the report and sends it when the signal returns.
      if (!navigator.onLine || err instanceof TypeError) {
        setResult({ kind: "offline", count: selected.length })
        setSelected([])
      } else {
        setResult({ kind: "error", message: err instanceof Error ? err.message : "Gagal mengirim" })
      }
    } finally {
      setSending(false)
    }
  }

  if (result && result.kind !== "error") {
    return (
      <AppShell title="Lapor" showWhatsApp={false}>
        <div className="flex flex-col items-center text-center gap-4 pt-10">
          {result.kind === "offline"
            ? <WifiOff className="w-20 h-20 text-amber-600" aria-hidden />
            : <CheckCircle2 className="w-20 h-20 text-emerald-600" aria-hidden />}
          <h1 className="text-3xl font-black">{result.kind === "offline" ? "Laporan disimpan" : "Terima kasih!"}</h1>
          <p className="text-lg max-w-sm">
            {result.kind === "offline"
              ? "Belum ada sinyal. Laporan akan terkirim otomatis saat HP tersambung lagi."
              : `Laporan Anda dari ${getBeachMeta(beach)?.label} sudah diterima. Peringatan keluar jika beberapa nelayan melaporkan tanda yang sama.`}
          </p>
          <Link to="/" className="w-full max-w-sm min-h-14 flex items-center justify-center rounded-2xl bg-sky-900 text-white text-lg font-bold">
            Lihat status pantai
          </Link>
          <button onClick={() => setResult(null)} className="min-h-12 text-lg font-semibold text-sky-800">Lapor tanda lain</button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Lapor" showWhatsApp={false}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black">Tanda apa yang Anda lihat?</h1>
          <p className="text-base text-gray-700">Sentuh satu atau lebih tanda, lalu tekan <b>Kirim</b>.</p>
        </div>

        <BeachPicker value={beach} onChange={setBeach} />

        <SignGrid signs={common} selected={selected} onToggle={toggle} />

        <button onClick={() => setShowAll(!showAll)} className="w-full min-h-12 rounded-xl border-2 border-gray-300 bg-white text-base font-semibold">
          {showAll ? "Sembunyikan tanda lain" : `Tanda lain (${rare.length})`}
        </button>
        {showAll && <SignGrid signs={rare} selected={selected} onToggle={toggle} />}

        {result?.kind === "error" && (
          <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">
            Gagal mengirim: {result.message}. Coba lagi.
          </p>
        )}
        <div className="h-20" aria-hidden />
      </div>

      <div className="fixed inset-x-0 z-40 px-4" style={{ bottom: "calc(4.75rem + var(--safe-area-inset-bottom))" }}>
        <button onClick={send} disabled={selected.length === 0 || sending}
          className="max-w-xl mx-auto w-full min-h-16 rounded-2xl bg-orange-600 text-white text-xl font-extrabold shadow-xl flex items-center justify-center gap-3 disabled:bg-gray-400">
          <Send className="w-6 h-6" aria-hidden />
          {sending ? "Mengirim..." : selected.length === 0 ? "Pilih tanda dulu" : `Kirim ${selected.length} tanda`}
        </button>
      </div>
    </AppShell>
  )
}

function SignGrid({ signs, selected, onToggle }: { signs: Sign[]; selected: string[]; onToggle: (c: string) => void }) {
  const groups = SIGN_GROUPS.map((g) => ({ ...g, items: signs.filter((s) => s.group === g.id) })).filter((g) => g.items.length)
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id}>
          <h2 className="text-base font-bold text-gray-700 mb-2">{g.emoji} {g.label}</h2>
          <div className="grid grid-cols-2 gap-3">
            {g.items.map((s) => {
              const on = selected.includes(s.code)
              return (
                <button key={s.code} onClick={() => onToggle(s.code)} aria-pressed={on}
                  className={`relative min-h-28 rounded-2xl border-2 p-3 text-left flex flex-col gap-1 ${
                    on ? "bg-orange-50 border-orange-600 ring-2 ring-orange-600" : "bg-white border-gray-300"}`}>
                  <span className="text-4xl" aria-hidden>{s.emoji}</span>
                  <span className="text-lg font-bold leading-tight">{s.short}</span>
                  <span className="text-xs text-gray-600 leading-snug line-clamp-2">{s.description}</span>
                  {on && <CheckCircle2 className="absolute top-2 right-2 w-7 h-7 text-orange-600" aria-hidden />}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
