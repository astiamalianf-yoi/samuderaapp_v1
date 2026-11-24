import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardCheck, Wind } from "lucide-react"
import { getSign } from "../constants/signs"
import { getBeachMeta } from "../constants/observationData"
import { fishermenService, RESPONSE_OPTIONS, type PendingFollowup } from "../services/fishermenService"
import type { Registration } from "../lib/registration"

/** "24 Nov 09.04 WIB" */
const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".") + " WIB"

/**
 * Beranda: two separate questions after his own sign report (app or WhatsApp), for 24 hours.
 * "Apa yang Anda lakukan?" (codebook No. 29) and "Angin kencang datang?" (Ya = Lapor kejadian).
 * Each card disappears as soon as it is answered; both disappear 24 h after the report.
 */
export function ReportFollowupCards({ registration }: { registration: Registration | null }) {
  const [p, setP] = useState<PendingFollowup | null>(null)
  const [busy, setBusy] = useState(false)
  const [thanks, setThanks] = useState<string | null>(null)
  const token = registration?.token

  const load = useCallback(() => {
    if (!token) { setP(null); return }
    fishermenService.followup(token).then((r) => setP(r.pending)).catch(() => {})
  }, [token])

  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === "visible") load() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [load])

  // Gone at the end of the 24 hours, even with the app left open.
  useEffect(() => {
    if (!p) return
    const ms = Date.parse(p.until) - Date.now()
    if (ms <= 0) { setP(null); return }
    const t = setTimeout(() => setP(null), Math.min(ms, 2_147_000_000))
    return () => clearTimeout(t)
  }, [p])

  useEffect(() => {
    if (!thanks) return
    const t = setTimeout(() => setThanks(null), 4000)
    return () => clearTimeout(t)
  }, [thanks])

  const answer = async (kind: "response" | "hazard", value: string) => {
    if (!token || !p || busy) return
    setBusy(true)
    // Hidden at once; the server's answer brings back what is still open.
    setP({ ...p, ...(kind === "response" ? { needResponse: false } : { needHazard: false }) })
    try {
      const r = await fishermenService.answerFollowup(token, { reportId: p.reportId, kind, value })
      setP(r.pending)
    } catch {
      load()
    } finally {
      setBusy(false)
    }
    setThanks("Terima kasih, jawaban Anda tercatat.")
  }

  if (!p || (!p.needResponse && !p.needHazard)) {
    return thanks ? <p className="text-base text-emerald-700 font-semibold" role="status">✓ {thanks}</p> : null
  }

  const signNames = p.signs.map((c) => getSign(c)?.short ?? c).join(", ")
  const beachName = getBeachMeta(p.beach)?.label ?? p.beach
  const via = p.channel === "WHATSAPP" ? " lewat WhatsApp" : ""
  const about = (
    <p className="text-sm text-gray-600">
      Laporan Anda{via}: <b>{signNames}</b> · {beachName} · {waktu(p.reportedAt)}
    </p>
  )
  const until = <p className="text-xs text-gray-500">Pertanyaan ini hilang {waktu(p.until)}.</p>

  return (
    <div className="space-y-3" data-testid="followup-cards">
      {thanks && <p className="text-base text-emerald-700 font-semibold" role="status">✓ {thanks}</p>}
      {p.needResponse && (
        <section className="rounded-2xl border-2 border-sky-700 bg-sky-50 p-4 space-y-2" data-testid="followup-response">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-sky-950">
            <ClipboardCheck className="w-6 h-6" aria-hidden /> Apa yang Anda lakukan setelah melihat tanda ini?
          </h2>
          {about}
          <div className="grid gap-2">
            {RESPONSE_OPTIONS.map((o) => (
              <button key={o.key} type="button" disabled={busy} onClick={() => answer("response", o.key)}
                className="min-h-12 rounded-xl bg-white border border-sky-300 px-3 text-left text-base font-semibold active:bg-sky-100">
                {o.label}
              </button>
            ))}
          </div>
          {until}
        </section>
      )}
      {p.needHazard && (
        <section className="rounded-2xl border-2 border-red-500 bg-white p-4 space-y-2" data-testid="followup-hazard">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-red-800">
            <Wind className="w-6 h-6" aria-hidden /> Apakah angin kencang datang setelah tanda ini?
          </h2>
          {about}
          <div className="grid grid-cols-2 gap-2">
            <Link to={`/kejadian?type=angin_kencang&beach=${encodeURIComponent(p.beach)}`}
              className="min-h-12 rounded-xl bg-red-600 text-white flex items-center justify-center text-base font-bold px-2 text-center">
              Ya, lapor kejadian
            </Link>
            <button type="button" disabled={busy} onClick={() => answer("hazard", "not_came")}
              className="min-h-12 rounded-xl border-2 border-gray-300 bg-white text-base font-bold px-2">
              Tidak datang
            </button>
          </div>
          {until}
        </section>
      )}
    </div>
  )
}
