import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, CloudLightning, MapPin, MessageCircle, Phone, Siren, Waves, Wind, MoveRight } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BeachPicker } from "../components/BeachPicker"
import { getBeachMeta } from "../constants/observationData"
import { useRegistration, useSelectedBeach } from "../hooks/useAppState"
import { fishermenService, type IncidentType } from "../services/fishermenService"

/** Hazards at sea, codebook No. 12 codes B.2-B.5. */
const TYPES: { key: IncidentType; label: string; icon: ReactNode }[] = [
  { key: "angin_kencang", label: "Angin kencang di laut", icon: <Wind className="w-8 h-8" aria-hidden /> },
  { key: "gelombang_ekstrem", label: "Gelombang ekstrem", icon: <Waves className="w-8 h-8" aria-hidden /> },
  { key: "badai", label: "Badai / hujan lebat", icon: <CloudLightning className="w-8 h-8" aria-hidden /> },
  { key: "arus_kuat", label: "Arus kuat", icon: <MoveRight className="w-8 h-8" aria-hidden /> },
]

/** Emergency numbers (Basarnas 115, national emergency 112), always one tap away on this page. */
export function CallButtons() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href="tel:115" className="min-h-16 rounded-2xl bg-red-600 text-white flex flex-col items-center justify-center font-extrabold">
        <span className="flex items-center gap-2 text-2xl"><Phone className="w-6 h-6" aria-hidden /> 115</span>
        <span className="text-sm font-semibold">Basarnas (SAR)</span>
      </a>
      <a href="tel:112" className="min-h-16 rounded-2xl bg-red-600 text-white flex flex-col items-center justify-center font-extrabold">
        <span className="flex items-center gap-2 text-2xl"><Phone className="w-6 h-6" aria-hidden /> 112</span>
        <span className="text-sm font-semibold">Panggilan darurat</span>
      </a>
    </div>
  )
}

const getPosition = () =>
  new Promise<GeolocationPosition | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 })
  })

type Result = { help: boolean; helpSent: boolean; helpReason: string | null }

/**
 * "Lapor kejadian / Minta bantuan": a fisherman met dangerous weather at sea. The incident raises
 * his level of interaction with disaster (adaptive profile). With "Saya butuh bantuan", a help
 * message with his beach, GPS location and WhatsApp number goes to the WhatsApp group.
 */
export function IncidentPage() {
  const registration = useRegistration()
  const [beach, setBeach] = useSelectedBeach()
  const [type, setType] = useState<IncidentType | null>(null)
  const [needHelp, setNeedHelp] = useState(false)
  const [shareGps, setShareGps] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const beachName = getBeachMeta(beach)?.label ?? beach
  const typeLabel = TYPES.find((t) => t.key === type)?.label ?? ""
  // Works even without internet: WhatsApp keeps the message and sends it when the signal returns.
  const waFallback = `https://wa.me/?text=${encodeURIComponent(
    `🆘 NELAYAN BUTUH BANTUAN\n📍 ${beachName}\n⚠️ ${typeLabel || "Bahaya di laut"}\nMohon segera bantu. Darurat: Basarnas 115 / 112.`,
  )}`

  if (!registration) {
    return (
      <AppShell title="Kejadian" showWhatsApp={false}>
        <div className="space-y-5 pt-4">
          <h1 className="text-2xl font-black">Dalam bahaya di laut?</h1>
          <p className="text-lg">Telepon sekarang:</p>
          <CallButtons />
          <p className="text-base text-gray-700">
            Untuk melapor kejadian dan mengirim permintaan bantuan ke grup WhatsApp, daftar dulu sekali.
          </p>
          <Link to="/profil" className="w-full min-h-14 flex items-center justify-center rounded-2xl bg-sky-900 text-white text-lg font-bold">
            Daftar sekarang
          </Link>
        </div>
      </AppShell>
    )
  }

  if (result) {
    return (
      <AppShell title="Kejadian" showWhatsApp={false}>
        <div className="flex flex-col items-center text-center gap-4 pt-8">
          <CheckCircle2 className="w-20 h-20 text-emerald-600" aria-hidden />
          <h1 className="text-3xl font-black">
            {!result.help ? "Kejadian tercatat" : result.helpSent ? "Permintaan bantuan terkirim" : "Kejadian tercatat"}
          </h1>
          <p className="text-lg max-w-sm">
            {!result.help
              ? "Terima kasih. Kejadian ini ikut memperbarui profil Anda supaya peringatan makin sesuai."
              : result.helpSent
                ? `Pesan bantuan sudah dikirim ke grup WhatsApp untuk ${beachName}.`
                : result.helpReason === "already_sent"
                  ? "Permintaan bantuan Anda sudah terkirim beberapa menit lalu. Jika masih darurat, telepon sekarang."
                  : "Pesan bantuan belum terkirim ke grup. Telepon sekarang, atau kirim lewat WhatsApp."}
          </p>
          {result.help && (
            <div className="w-full max-w-sm space-y-3">
              <CallButtons />
              {!result.helpSent && (
                <a href={waFallback} className="min-h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white text-lg font-bold">
                  <MessageCircle className="w-6 h-6" aria-hidden /> Kirim lewat WhatsApp
                </a>
              )}
            </div>
          )}
          <Link to="/" className="min-h-12 flex items-center text-lg font-semibold text-sky-800">Kembali ke beranda</Link>
        </div>
      </AppShell>
    )
  }

  const send = async () => {
    if (!type) {
      setError("Pilih dulu apa yang terjadi.")
      return
    }
    setSending(true)
    setError(null)
    try {
      const pos = needHelp && shareGps ? await getPosition() : null
      const res = await fishermenService.reportIncident(registration.token, {
        beach, type, needHelp,
        ...(pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : {}),
        ...(needHelp && registration.phone ? { contactPhone: registration.phone } : {}),
      })
      setResult({ help: needHelp, helpSent: res.helpSent, helpReason: res.helpReason })
    } catch {
      setError(needHelp
        ? "Tidak bisa mengirim (sinyal?). Telepon 115 / 112, atau kirim lewat WhatsApp di bawah."
        : "Tidak bisa mengirim. Coba lagi saat ada sinyal.")
    } finally {
      setSending(false)
    }
  }

  return (
    <AppShell title="Kejadian" showWhatsApp={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black">Lapor kejadian di laut</h1>
          <p className="text-base text-gray-700">Mengalami bahaya di laut? Laporkan di sini, dan minta bantuan jika perlu.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-lg font-bold mb-2">Apa yang terjadi?</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const on = type === t.key
              return (
                <button key={t.key} type="button" aria-pressed={on} onClick={() => setType(t.key)}
                  className={`min-h-24 rounded-2xl border-2 p-3 flex flex-col items-center justify-center gap-1 text-center text-base font-bold ${
                    on ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
                  {t.icon}
                  {t.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <BeachPicker value={beach} onChange={setBeach} homeBeach={registration.homeBeach as typeof beach} />

        <button type="button" role="switch" aria-checked={needHelp} onClick={() => setNeedHelp((v) => !v)}
          className={`w-full min-h-16 rounded-2xl border-2 px-4 flex items-center gap-3 text-left text-lg font-extrabold ${
            needHelp ? "bg-red-600 border-red-600 text-white" : "bg-white border-red-500 text-red-700"}`}>
          <Siren className="w-8 h-8 shrink-0" aria-hidden />
          <span className="flex-1">Saya butuh bantuan sekarang</span>
          <span className={`w-12 h-7 rounded-full p-1 ${needHelp ? "bg-white/40" : "bg-gray-300"}`}>
            <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${needHelp ? "translate-x-5" : ""}`} />
          </span>
        </button>

        {needHelp && (
          <section className="rounded-2xl bg-red-50 border-2 border-red-300 p-4 space-y-3">
            <p className="text-lg font-bold text-red-800">Jika darurat, telepon dulu:</p>
            <CallButtons />
            <label className="flex items-center gap-3 text-base">
              <input type="checkbox" checked={shareGps} onChange={(e) => setShareGps(e.target.checked)} className="w-6 h-6" />
              <span className="flex items-center gap-1"><MapPin className="w-5 h-5 text-red-700" aria-hidden /> Bagikan lokasi GPS saya</span>
            </label>
            <p className="text-sm text-gray-700">
              Pesan bantuan dikirim ke grup WhatsApp dengan pantai, kejadian, lokasi
              {registration.phone ? ` dan nomor WhatsApp Anda (••••${registration.phoneLast4})` : ""}, supaya nelayan terdekat bisa menolong.
            </p>
          </section>
        )}

        {error && (
          <div className="space-y-3">
            <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">{error}</p>
            {needHelp && (
              <a href={waFallback} className="min-h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white text-lg font-bold">
                <MessageCircle className="w-6 h-6" aria-hidden /> Kirim lewat WhatsApp
              </a>
            )}
          </div>
        )}

        <button onClick={send} disabled={sending}
          className={`w-full min-h-16 rounded-2xl text-white text-xl font-extrabold disabled:opacity-60 ${needHelp ? "bg-red-600" : "bg-sky-900"}`}>
          {sending ? "Mengirim…" : needHelp ? "Kirim permintaan bantuan" : "Kirim laporan kejadian"}
        </button>
      </div>
    </AppShell>
  )
}
