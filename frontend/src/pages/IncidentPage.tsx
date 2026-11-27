import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckCircle2, CloudLightning, MapPin, MessageCircle, Phone, Siren, Waves, Wind, MoveRight, Wrench } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BeachPicker } from "../components/BeachPicker"
import { getBeachMeta } from "../constants/observationData"
import { useRegistration, useSelectedBeach } from "../hooks/useAppState"
import { fishermenService, type IncidentType } from "../services/fishermenService"

/** What happened: hazards at sea (codebook No. 12 codes B.2-B.5), or a boat / gear problem. */
const TYPES: { key: IncidentType; label: string; icon: ReactNode }[] = [
  { key: "angin_kencang", label: "Angin kencang di laut", icon: <Wind className="w-6 h-6 shrink-0" aria-hidden /> },
  { key: "gelombang_ekstrem", label: "Gelombang ekstrem", icon: <Waves className="w-6 h-6 shrink-0" aria-hidden /> },
  { key: "badai", label: "Badai / hujan lebat", icon: <CloudLightning className="w-6 h-6 shrink-0" aria-hidden /> },
  { key: "arus_kuat", label: "Arus kuat", icon: <MoveRight className="w-6 h-6 shrink-0" aria-hidden /> },
  // Not a hazard: help with the boat or the fishing gear.
  { key: "masalah_kapal", label: "Masalah kapal / alat tangkap", icon: <Wrench className="w-6 h-6 shrink-0" aria-hidden /> },
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

type Gps =
  | { status: "idle" | "searching" }
  | { status: "ok"; lat: number; lon: number; accuracy: number }
  | { status: "denied" | "unavailable" }

const once = (opts: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts))

/**
 * Asks the phone for its position: precise GPS first (up to 20 s, a fix at sea can take a while),
 * then any recent position (network / last known, up to 10 minutes old). Never throws.
 */
async function locate(): Promise<Gps> {
  if (!("geolocation" in navigator)) return { status: "unavailable" }
  for (const opts of [
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
  ]) {
    try {
      const p = await once(opts)
      return { status: "ok", lat: p.coords.latitude, lon: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }
    } catch (e) {
      if ((e as GeolocationPositionError)?.code === 1) return { status: "denied" }
    }
  }
  return { status: "unavailable" }
}

type Result = { help: boolean; helpSent: boolean; helpReason: string | null }

/**
 * "Minta bantuan": one tap sends a help message (beach, GPS location, WhatsApp number) to the
 * WhatsApp group of the beach. What happened is optional; when chosen it is also recorded as an
 * incident (adaptive profile, Trust Index). Hazards without a call for help are answered on
 * Beranda (the cards after a sign report) or with !kejadian in WhatsApp.
 */
export function IncidentPage() {
  const registration = useRegistration()
  const [beach, setBeach] = useSelectedBeach()
  // From the Beranda question "Angin kencang datang?": the beach of his report and strong wind, ready to send.
  const [params] = useSearchParams()
  const presetType = TYPES.find((t) => t.key === params.get("type"))?.key ?? null
  const presetBeach = params.get("beach")
  useEffect(() => {
    if (presetBeach && presetBeach !== beach && getBeachMeta(presetBeach as typeof beach)) setBeach(presetBeach as typeof beach)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetBeach])
  const [type, setType] = useState<IncidentType | null>(presetType)
  // This page is always a call for help (Beranda "Butuh bantuan di laut?"); one tap sends it.
  const needHelp = true
  const [shareGps, setShareGps] = useState(true)
  // Location is looked up as soon as he asks for help (not only on "Kirim"), so it is ready in time
  // and he can see whether it worked before sending.
  const [gps, setGps] = useState<Gps>({ status: "idle" })
  const gpsJob = useRef<Promise<Gps> | null>(null)
  const startGps = () => {
    setGps({ status: "searching" })
    const job = locate()
    gpsJob.current = job
    job.then((g) => { if (gpsJob.current === job) setGps(g) })
    return job
  }
  useEffect(() => {
    if (shareGps && gps.status === "idle") startGps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareGps])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const beachName = getBeachMeta(beach)?.label ?? beach
  const typeLabel = TYPES.find((t) => t.key === type)?.label ?? ""
  // Works even without internet: WhatsApp keeps the message and sends it when the signal returns.
  const waFallback = `https://wa.me/?text=${encodeURIComponent(
    `🆘 NELAYAN BUTUH BANTUAN\n📍 ${beachName}\n⚠️ ${typeLabel || "Bahaya di laut"}\n` +
      (gps.status === "ok" ? `🗺️ Lokasi: https://maps.google.com/?q=${gps.lat.toFixed(5)},${gps.lon.toFixed(5)}\n` : "") +
      "Mohon segera bantu. Darurat: Basarnas 115 / 112.",
  )}`

  if (!registration) {
    return (
      <AppShell title="Minta bantuan" showWhatsApp={false}>
        <div className="space-y-5 pt-4">
          <h1 className="text-2xl font-black">Dalam bahaya di laut?</h1>
          <p className="text-lg">Telepon sekarang:</p>
          <CallButtons />
          <p className="text-base text-gray-700">
            Untuk mengirim permintaan bantuan ke grup WhatsApp nelayan, daftar dulu sekali.
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
      <AppShell title="Minta bantuan" showWhatsApp={false}>
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
      let where: Gps | null = null
      if (needHelp && shareGps) {
        where = gps.status === "ok" ? gps : await (gps.status === "searching" && gpsJob.current ? gpsJob.current : startGps())
      }
      const res = await fishermenService.reportIncident(registration.token, {
        beach, type, needHelp,
        ...(where?.status === "ok" ? { lat: where.lat, lon: where.lon } : {}),
        ...(needHelp ? { locationStatus: !shareGps ? "not_shared" : where?.status === "denied" ? "denied" : where?.status === "ok" ? undefined : "unavailable" } : {}),
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
    <AppShell title="Minta bantuan" showWhatsApp={false}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black">Minta bantuan</h1>
          <p className="text-base text-gray-700">
            Pesan bantuan dikirim ke grup WhatsApp nelayan {beachName}, dengan lokasi
            {registration.phone ? ` dan nomor WhatsApp Anda (••••${registration.phoneLast4})` : ""}, supaya nelayan terdekat bisa menolong.
          </p>
        </div>

        <section className="space-y-2">
          <p className="text-lg font-bold text-red-800">Darurat? Telepon dulu:</p>
          <CallButtons />
        </section>

        <fieldset className="space-y-2">
          <legend className="text-lg font-bold mb-1">1. Apa yang terjadi?</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => {
              const on = type === t.key
              return (
                <button key={t.key} type="button" aria-pressed={on} onClick={() => { setType(t.key); setError(null) }}
                  className={`min-h-14 rounded-xl border-2 px-2 flex items-center gap-2 text-left text-sm font-bold ${
                    t.key === "masalah_kapal" ? "col-span-2" : ""} ${
                    on ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
                  {t.icon}
                  {t.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <section className="space-y-2">
          <p className="text-lg font-bold">2. Di mana?</p>
          <BeachPicker value={beach} onChange={setBeach} homeBeach={registration.homeBeach as typeof beach} />
        <div className="text-base space-y-1" role="status" data-testid="gps-status">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={shareGps} onChange={(e) => setShareGps(e.target.checked)} className="w-6 h-6" />
            <span className="flex items-center gap-1"><MapPin className="w-5 h-5 text-red-700" aria-hidden /> Bagikan lokasi GPS saya</span>
          </label>
          {shareGps && gps.status === "searching" && <p className="text-gray-700">📡 Mencari lokasi Anda…</p>}
          {shareGps && gps.status === "ok" && <p className="text-emerald-800 font-semibold">✅ Lokasi ditemukan (± {gps.accuracy} m)</p>}
          {shareGps && gps.status === "denied" && (
            <p className="text-red-800">
              ⚠️ HP tidak mengizinkan lokasi. Izinkan lokasi di pengaturan HP, lalu{" "}
              <button type="button" onClick={startGps} className="underline font-semibold">coba lagi</button>. Tanpa lokasi, pesan tetap terkirim.
            </p>
          )}
          {shareGps && gps.status === "unavailable" && (
            <p className="text-red-800">
              ⚠️ Lokasi belum didapat. Nyalakan GPS di HP lalu{" "}
              <button type="button" onClick={startGps} className="underline font-semibold">coba lagi</button>. Tanpa lokasi, pesan tetap terkirim.
            </p>
          )}
        </div>

        </section>

        {error && (
          <div className="space-y-3">
            <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">{error}</p>
            {type && (
              <a href={waFallback} className="min-h-14 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white text-lg font-bold">
                <MessageCircle className="w-6 h-6" aria-hidden /> Kirim lewat WhatsApp
              </a>
            )}
          </div>
        )}

        <button onClick={send} disabled={sending}
          className="w-full min-h-16 rounded-2xl bg-red-600 text-white text-xl font-extrabold disabled:opacity-60 flex items-center justify-center gap-3">
          <Siren className="w-7 h-7" aria-hidden />
          {sending ? "Mengirim…" : "Kirim permintaan bantuan"}
        </button>
      </div>
    </AppShell>
  )
}
