import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { Activity as ActivityIcon, ArrowDown, ArrowLeft, ArrowUp, Home, Minus, Pencil, Phone, Plus, ShieldCheck, UserRound } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BEACH_LOCATIONS } from "../constants/observationData"
import { useHomeBeach, useRegistration } from "../hooks/useAppState"
import { normalizePhone, saveRegistration } from "../lib/registration"
import { fishermenService, type Activity, type ProfileView } from "../services/fishermenService"
import {
  currentYear, HAZARD_OPTIONS, loadAnswers, saveAnswers, validateAnswers, type HazardKey, type ProfileAnswers,
} from "../lib/profile"

const YEAR = currentYear()

const DEFAULTS: Partial<ProfileAnswers> = {
  birth_year: YEAR - 40, fishing_start_year: YEAR - 15, lik_start_year: YEAR - 10, hazards: ["angin_kencang"],
  disaster_interaction: 0, lik_combination_count: 2, usage_frequency_min: 2, usage_frequency_max: 4,
}

type QuestionId = keyof ProfileAnswers | "phone" | "home" | "consent"

/**
 * Registration = WhatsApp number + home beach + consent + 10 profile questions. Years are asked
 * instead of ages, so age, fishing experience and years using natural signs stay right every year.
 * After registration the server raises the answers with his activity (reports, signs used,
 * incidents); the category (Actionable / Inaction) is for researchers only and is not shown here.
 */
/** /profil: registered = a read-only view (Profil Anda, Aktivitas Anda) with an "Ubah profil" button;
 *  not registered = the registration form. */
export function ProfilePage() {
  const registration = useRegistration()
  // Keep the form (and its "Anda sudah terdaftar" screen) for a fisherman who registers on this visit.
  const [registering] = useState(!registration)
  return registration && !registering ? <ProfileOverview /> : <ProfileForm />
}

/** /profil/ubah: the same form, for changing number, home beach or answers. */
export function ProfileEditPage() {
  const registration = useRegistration()
  return registration ? <ProfileForm /> : <Navigate to="/profil" replace />
}

const PRIVACY_NOTE = (
  <p className="mt-2 text-sm text-gray-600 bg-white rounded-xl border border-gray-200 p-3">
    🔒 Nomor WhatsApp dipakai agar laporan Anda dari aplikasi dan dari grup WhatsApp dikenali sebagai laporan
    Anda. Server tidak menyimpan nomor lengkap, hanya kode acak dan 4 angka terakhir. Tidak ada nama yang diminta.
  </p>
)

function ProfileOverview() {
  const registration = useRegistration()!
  const home = BEACH_LOCATIONS.find((b) => b.value === registration.homeBeach)
  return (
    <AppShell title="Profil">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black">Profil nelayan</h1>
          <p className="text-base text-gray-700">
            Terdaftar dengan nomor WhatsApp ••••{registration.phoneLast4}
            {home ? <>, pantai asal <b>{home.label.replace("Pantai ", "")}</b></> : null}.
          </p>
          {PRIVACY_NOTE}
        </div>

        <ActivityCard token={registration.token} />

        <Link to="/profil/ubah"
          className="w-full min-h-16 flex items-center justify-center gap-2 rounded-2xl bg-sky-900 text-white text-xl font-extrabold">
          <Pencil className="w-6 h-6" aria-hidden /> Ubah profil
        </Link>
        <p className="-mt-3 text-center text-sm text-gray-600">Nomor WhatsApp, pantai asal dan jawaban pertanyaan.</p>

        <button onClick={() => { saveAnswers(null); saveRegistration(null) }}
          className="w-full min-h-12 rounded-xl border-2 border-gray-300 text-base font-semibold text-gray-700">
          Keluar dan hapus profil dari HP ini
        </button>

        <Link to="/mulai" className="block text-center min-h-12 py-3 text-base font-semibold text-sky-800">
          Lihat pengenalan aplikasi lagi
        </Link>
      </div>
    </AppShell>
  )
}

function ProfileForm() {
  const savedAnswers = loadAnswers()
  const registration = useRegistration()
  const [home] = useHomeBeach()
  const [a, setA] = useState<Partial<ProfileAnswers>>(savedAnswers ?? DEFAULTS)
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [phone, setPhone] = useState("")
  const [consent, setConsent] = useState(Boolean(registration))
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  // The form opened from "Ubah profil" (already registered) rather than a first registration.
  const [editing] = useState(Boolean(registration))

  useEffect(() => {
    if (!editing) return
    window.scrollTo?.(0, 0)
    // Answers saved on another phone (or before this phone kept them): take them from the server,
    // so saving here never overwrites his real answers with the defaults.
    if (savedAnswers || !registration) return
    let live = true
    fishermenService.me(registration.token)
      .then((r) => { if (live && r.fisherman.profile) setA(r.fisherman.profile as Partial<ProfileAnswers>) })
      .catch(() => {})
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = <K extends keyof ProfileAnswers>(k: K, v: ProfileAnswers[K]) => setA((cur) => ({ ...cur, [k]: v }))

  const submit = async () => {
    const errs: string[] = []
    // A new number is needed unless this phone is already registered (then it may stay empty).
    if (!registration || phone.trim()) {
      if (!normalizePhone(phone)) errs.push("phone")
    }
    if (!home) errs.push("home")
    if (!consent) errs.push("consent")
    errs.push(...validateAnswers(a))
    setErrors(errs)
    setServerError(null)
    if (errs.length) {
      document.getElementById(`q-${errs[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    const answers = a as ProfileAnswers
    setSending(true)
    try {
      const res = registration && !phone.trim()
        ? { ...(await fishermenService.update(registration.token, { homeBeach: home!, profile: answers })), token: registration.token }
        : await fishermenService.register({ phone, homeBeach: home!, profile: answers, consent: true })
      saveAnswers(answers)
      saveRegistration({
        token: res.token, fishermanId: res.fisherman.id, phoneLast4: res.fisherman.phoneLast4, homeBeach: res.fisherman.homeBeach,
        phone: phone.trim() ? normalizePhone(phone) ?? undefined : registration?.phone,
      })
      setPhone("")
      setDone(true)
    } catch (err) {
      setServerError(
        err instanceof TypeError || !navigator.onLine
          ? "Belum ada sinyal. Pendaftaran perlu internet, coba lagi nanti."
          : err instanceof Error ? err.message : "Gagal mendaftar",
      )
    } finally {
      setSending(false)
    }
  }

  if (done && editing) {
    return (
      <AppShell title="Profil">
        <div className="flex flex-col items-center text-center gap-4 pt-10">
          <ShieldCheck className="w-20 h-20 text-emerald-600" aria-hidden />
          <h1 className="text-3xl font-black">Profil diperbarui</h1>
          <p className="text-lg max-w-sm">Perubahan Anda sudah disimpan, dan peringatan untuk Anda ikut menyesuaikan.</p>
          <Link to="/profil" className="w-full max-w-sm min-h-14 flex items-center justify-center rounded-2xl bg-sky-900 text-white text-lg font-bold">Kembali ke profil</Link>
        </div>
      </AppShell>
    )
  }

  if (done) {
    return (
      <AppShell title="Profil">
        <div className="flex flex-col items-center text-center gap-4 pt-10">
          <ShieldCheck className="w-20 h-20 text-emerald-600" aria-hidden />
          <h1 className="text-3xl font-black">Anda sudah terdaftar</h1>
          <p className="text-lg max-w-sm">
            Sekarang Anda bisa melapor tanda alam. Laporan Anda dari aplikasi dan dari grup WhatsApp (nomor
            ••••{registration?.phoneLast4}) dikenali sebagai laporan Anda, dan peringatan disesuaikan dengan pengalaman Anda.
          </p>
          <Link to="/lapor" className="w-full max-w-sm min-h-14 flex items-center justify-center rounded-2xl bg-orange-600 text-white text-lg font-bold">Lapor tanda alam</Link>
          <Link to="/" className="w-full max-w-sm min-h-14 flex items-center justify-center rounded-2xl bg-sky-900 text-white text-lg font-bold">Kembali ke beranda</Link>
          <button onClick={() => setDone(false)} className="min-h-12 text-lg font-semibold text-sky-800">Ubah jawaban</button>
        </div>
      </AppShell>
    )
  }

  const err = (k: QuestionId) => errors.includes(k)
  const hazards = a.hazards ?? []

  return (
    <AppShell title="Profil">
      <div className="space-y-6">
        <div>
          {editing && (
            <Link to="/profil" className="inline-flex items-center gap-1 min-h-11 mb-1 text-base font-semibold text-sky-800">
              <ArrowLeft className="w-5 h-5" aria-hidden /> Kembali ke profil
            </Link>
          )}
          <h1 className="text-2xl font-black">{editing ? "Ubah profil" : "Daftar sebagai nelayan"}</h1>
          <p className="text-base text-gray-700">
            {editing
              ? `Terdaftar dengan nomor WhatsApp ••••${registration?.phoneLast4}. Ubah yang perlu, lalu tekan Simpan perubahan.`
              : "Daftar sekali untuk bisa melapor tanda alam. Peringatan tetap bisa dilihat tanpa mendaftar."}
          </p>
          {PRIVACY_NOTE}
        </div>

        <div id="q-phone" className={`rounded-2xl p-3 ${err("phone") ? "bg-red-50 ring-2 ring-red-500" : ""}`}>
          <label htmlFor="in-phone" className="flex items-center gap-2 text-lg font-bold mb-2">
            <Phone className="w-5 h-5 text-sky-800" aria-hidden /> Nomor WhatsApp Anda
          </label>
          <input id="in-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={registration ? `••••${registration.phoneLast4}` : "contoh: 0812 3456 7890"}
            className="w-full min-h-14 rounded-xl border-2 border-gray-300 px-4 text-xl" />
          {registration && !err("phone") && <p className="mt-1 text-base text-gray-600">Kosongkan jika nomor tidak berubah.</p>}
          {err("phone") && <p className="mt-1 text-base text-red-700">Nomor belum benar. Tulis seperti 0812 3456 7890.</p>}
        </div>

        <div id="q-home" className={`rounded-2xl ${err("home") ? "ring-2 ring-red-500" : ""}`}>
          <HomeBeachChooser required showError={err("home")} />
        </div>

        <Stepper id="birth_year" label="1. Tahun berapa Anda lahir?" min={1920} max={YEAR - 10}
          value={a.birth_year} onChange={(v) => set("birth_year", v)} error={err("birth_year")}
          note={a.birth_year ? `Umur ${YEAR - a.birth_year} tahun pada ${YEAR}` : undefined} />
        <Stepper id="fishing_start_year" label="2. Sejak tahun berapa Anda menjadi nelayan?" min={a.birth_year ?? 1920} max={YEAR}
          value={a.fishing_start_year} onChange={(v) => set("fishing_start_year", v)} error={err("fishing_start_year")}
          note={a.fishing_start_year ? `${YEAR - a.fishing_start_year} tahun menjadi nelayan` : undefined} />

        <Choice id="fishing_role" label="3. Apa peran Anda di perahu?" value={a.fishing_role} error={err("fishing_role")}
          options={[[1, "Pemilik perahu"], [2, "Tekong / nakhoda"], [3, "ABK / awak"]]} onChange={(v) => set("fishing_role", v as 1 | 2 | 3)} />
        <Choice id="head_of_community" label="4. Pernah menjadi ketua kelompok nelayan?" value={a.head_of_community} error={err("head_of_community")}
          options={[[1, "Ya"], [0, "Tidak"]]} onChange={(v) => set("head_of_community", v as 0 | 1)} />
        <Choice id="fishing_duration" label="5. Biasanya berapa lama sekali melaut?" value={a.fishing_duration} error={err("fishing_duration")}
          options={[[1, "Kurang dari 1 hari"], [2, "Beberapa hari"], [3, "Beberapa minggu"]]} onChange={(v) => set("fishing_duration", v as 1 | 2 | 3)} />

        <fieldset id="q-hazards" className="space-y-2">
          <legend className="text-lg font-bold">6. Bencana atau bahaya apa saja yang pernah Anda alami dan Anda kenali dari tanda alam?</legend>
          <div className="grid grid-cols-2 gap-2">
            {HAZARD_OPTIONS.map(([key, text]) => {
              const on = hazards.includes(key)
              return (
                <button key={key} type="button" aria-pressed={on}
                  onClick={() => set("hazards", (on ? hazards.filter((x) => x !== key) : [...hazards, key]) as HazardKey[])}
                  className={`min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${on ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300"}`}>
                  {text}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Stepper id="disaster_interaction" label="7. Berapa kali Anda menghadapi kejadian angin kencang di laut?" unit="kali" min={0} max={50}
          value={a.disaster_interaction} onChange={(v) => set("disaster_interaction", v)} error={err("disaster_interaction")} />
        <Stepper id="lik_combination_count" label="8. Berapa macam tanda alam yang biasa Anda pakai?" unit="tanda" min={1} max={17}
          value={a.lik_combination_count} onChange={(v) => set("lik_combination_count", v)} error={err("lik_combination_count")} />
        <Stepper id="lik_start_year" label="9. Sejak tahun berapa Anda memakai tanda alam?" min={a.birth_year ?? 1920} max={YEAR}
          value={a.lik_start_year} onChange={(v) => set("lik_start_year", v)} error={err("lik_start_year")}
          note={a.lik_start_year ? `${YEAR - a.lik_start_year} tahun memakai tanda alam` : undefined} />

        <div className="space-y-3">
          <p className="text-lg font-bold">10. Dalam sebulan, berapa kali Anda memakai tanda alam?</p>
          <Stepper id="usage_frequency_min" label="Paling sedikit" unit="kali" small min={0} max={60}
            value={a.usage_frequency_min} onChange={(v) => set("usage_frequency_min", v)} error={err("usage_frequency_min")} />
          <Stepper id="usage_frequency_max" label="Paling banyak" unit="kali" small min={0} max={60}
            value={a.usage_frequency_max} onChange={(v) => set("usage_frequency_max", v)} error={err("usage_frequency_max")} />
        </div>

        <label id="q-consent" className={`flex items-start gap-3 rounded-2xl border-2 p-4 ${
          err("consent") ? "bg-red-50 border-red-500" : "bg-white border-gray-300"}`}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-7 h-7 shrink-0" />
          <span className="text-base">
            Saya setuju nomor WhatsApp, pantai asal, jawaban profil, laporan dan kejadian yang saya laporkan dipakai
            untuk sistem peringatan Samudra dan untuk penelitian. Saya bisa menghapus data dari profil kapan saja.
          </span>
        </label>

        {serverError && (
          <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">{serverError}</p>
        )}

        {errors.length > 0 && (
          <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">
            Ada jawaban yang belum diisi atau belum masuk akal (ditandai merah).
          </p>
        )}

        <button onClick={submit} disabled={sending}
          className="w-full min-h-16 rounded-2xl bg-sky-900 text-white text-xl font-extrabold disabled:opacity-60">
          {sending ? "Mengirim…" : registration ? "Simpan perubahan" : "Daftar"}
        </button>
        {editing ? (
          <Link to="/profil" className="block text-center min-h-12 py-3 text-base font-semibold text-sky-800">Batal</Link>
        ) : (
          <Link to="/mulai" className="block text-center min-h-12 py-3 text-base font-semibold text-sky-800">
            Lihat pengenalan aplikasi lagi
          </Link>
        )}
      </div>
    </AppShell>
  )
}

/**
 * What he has done in SAMUDRA (his own data). It explains why the app keeps adapting to him;
 * the resulting category is deliberately not shown.
 */
function ActivityCard({ token }: { token: string }) {
  const [act, setAct] = useState<Activity | null>(null)
  const [view, setView] = useState<ProfileView | null>(null)
  useEffect(() => {
    let live = true
    fishermenService.me(token).then((r) => { if (live) { setAct(r.activity); setView(r.profile_view ?? null) } }).catch(() => {})
    return () => { live = false }
  }, [token])
  if (!act) return null
  return (
    <>
      {view && <ProfileViewCard view={view} />}
      <ActivitySection act={act} />
    </>
  )
}

/** His answers as he sees them (labels follow the Ubah profil form). */
const ROLE = { 1: "Pemilik perahu", 2: "Tekong / nakhoda", 3: "ABK / awak" } as Record<number, string>
const TRIP = { 1: "Kurang dari 1 hari", 2: "Beberapa hari", 3: "Beberapa minggu" } as Record<number, string>
const num = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 })
const ANSWER_TEXT: Record<string, { label: string; show: (a: ProfileView["answers"][number]) => string }> = {
  usage_frequency: { label: "Memakai tanda alam", show: (a) => `${num(a.value)} kali per bulan` },
  lik_combination_count: { label: "Jumlah tanda alam yang dipakai", show: (a) => `${num(a.value)} tanda` },
  usage_duration: { label: "Lama memakai tanda alam", show: (a) => `${num(a.value)} tahun` },
  disaster_interaction: { label: "Menghadapi kejadian angin kencang di laut", show: (a) => `${num(a.value)} kali` },
  disaster_experience_count: { label: "Jenis bencana yang pernah dialami dan dikenali dari tanda alam", show: (a) => `${num(a.value)} jenis` },
  age: { label: "Usia", show: (a) => `${num(a.value)} tahun` },
  fishing_experience: { label: "Lama menjadi nelayan", show: (a) => `${num(a.value)} tahun` },
  fishing_role: { label: "Peran di perahu", show: (a) => ROLE[a.value] ?? String(a.value) },
  fishing_duration: { label: "Lama sekali melaut", show: (a) => TRIP[a.value] ?? String(a.value) },
  head_of_community: { label: "Pernah menjadi ketua kelompok", show: (a) => (a.value ? "Ya" : "Tidak") },
}
const SIDE = {
  actionable: { box: "bg-teal-50 border-teal-500", pill: "bg-teal-600 text-white", word: "mendukung" },
  inaction: { box: "bg-amber-50 border-amber-500", pill: "bg-amber-500 text-white", word: "perlu perhatian" },
} as const

/**
 * "Profil Anda": the overall model class as colour and plain words (never Actionable/Inaction), the
 * three answers that moved HIS result most (per-fisherman SHAP of the Random Forest) and, folded,
 * all his answers. Present only when the server enables it.
 */
function ProfileViewCard({ view }: { view: ProfileView }) {
  const box = view.overall ? SIDE[view.overall].box : "bg-slate-50 border-slate-300"
  const byKey = Object.fromEntries((view.answers ?? []).map((a) => [a.key, a]))
  const top = (view.top ?? []).filter((t) => byKey[t.key])
  return (
    <section className={`rounded-2xl border-2 p-4 space-y-3 ${box}`} aria-label="Profil Anda" data-overall={view.overall ?? "unknown"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-lg font-bold"><UserRound className="w-5 h-5 text-sky-800" aria-hidden /> Profil Anda</p>
        {view.overall && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${SIDE[view.overall].pill}`} data-testid="profile-overall">
            <span className="w-2.5 h-2.5 rounded-full bg-white" aria-hidden />
            {SIDE[view.overall].word}
          </span>
        )}
      </div>

      {view.basis === "no_location_model" ? (
        <p className="rounded-xl bg-white border border-amber-300 p-3 text-sm text-gray-800" data-testid="profile-no-model">
          Model untuk pantai asal Anda belum tersedia. Sampai model itu ada, peringatan untuk Anda memakai sisi yang paling hati-hati, apa pun jawaban Anda.
        </p>
      ) : top.length > 0 ? (
        <>
          <p className="text-sm font-semibold text-gray-800">Yang paling memengaruhi hasil Anda:</p>
          <ul className="space-y-2" data-testid="profile-top">
            {top.map((t) => {
              const a = byKey[t.key]
              const up = t.push === "up"
              return (
                <li key={t.key} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 p-3" data-push={t.push}>
                  <span className={`shrink-0 rounded-full p-1 ${up ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`} aria-hidden>
                    {up ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  </span>
                  <span className="sr-only">{up ? "mendorong ke mendukung:" : "mendorong ke perlu perhatian:"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base text-gray-800 leading-snug">{ANSWER_TEXT[t.key]?.label ?? t.key}</span>
                    <span className="block text-base font-bold text-gray-900">{ANSWER_TEXT[t.key]?.show(a) ?? num(a.value)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1"><ArrowUp className="w-4 h-4 text-teal-700" aria-hidden /> mendorong ke mendukung</span>
            <span className="inline-flex items-center gap-1"><ArrowDown className="w-4 h-4 text-amber-700" aria-hidden /> mendorong ke perlu perhatian</span>
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-700">Penjelasan hasil Anda belum tersedia. Buka halaman ini lagi nanti.</p>
      )}

      {view.answers?.length > 0 && (
        <details className="rounded-xl bg-white/70 border border-gray-200 p-3" data-testid="profile-answers">
          <summary className="cursor-pointer text-sm font-semibold text-sky-900">Lihat semua jawaban Anda ({view.answers.length})</summary>
          <dl className="mt-2 divide-y divide-gray-100">
            {view.answers.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <dt className="text-gray-700">{ANSWER_TEXT[a.key]?.label ?? a.key}</dt>
                <dd className="font-semibold text-gray-900 text-right whitespace-nowrap">{ANSWER_TEXT[a.key]?.show(a) ?? num(a.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-gray-600">Ada yang salah? Perbaiki lewat tombol Ubah profil di bawah.</p>
        </details>
      )}

      <p className="text-sm text-gray-600">Hasil ini dihitung dari gabungan semua jawaban dan aktivitas Anda. Peringatan untuk Anda mengikuti warna kotak ini, dan bisa berubah sendiri saat Anda melapor.</p>
    </section>
  )
}

function ActivitySection({ act }: { act: Activity }) {
  const Row = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-xl bg-white border border-sky-100 p-3 text-center">
      <p className="text-3xl font-black text-sky-900">{value}</p>
      <p className="text-sm text-gray-700 leading-tight">{label}</p>
    </div>
  )
  return (
    <section className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-4 space-y-3" aria-label="Aktivitas Anda">
      <p className="flex items-center gap-2 text-lg font-bold"><ActivityIcon className="w-5 h-5 text-sky-800" aria-hidden /> Aktivitas Anda</p>
      <div className="grid grid-cols-3 gap-2">
        <Row label="laporan 30 hari terakhir" value={act.reports_30d} />
        <Row label="macam tanda dilaporkan" value={act.signs_12m.length} />
        <Row label="kejadian di laut" value={act.incidents_total} />
      </div>
      {act.channels_30d && (act.channels_30d.app > 0 || act.channels_30d.whatsapp > 0) && (
        <p className="text-base text-gray-800">
          Dikirim lewat aplikasi: <b>{act.channels_30d.app}</b> · lewat WhatsApp: <b>{act.channels_30d.whatsapp}</b>
        </p>
      )}
      <p className="text-sm text-gray-600">
        Laporan dan kejadian yang Anda kirim, lewat aplikasi atau grup WhatsApp dengan nomor ini, ikut memperbarui
        profil Anda, supaya peringatan makin sesuai dengan pengalaman Anda.
      </p>
    </section>
  )
}

function Stepper({ id, label, unit, value, onChange, error, small, min, max, note }: {
  id: QuestionId; label: string; unit?: string; value?: number; onChange: (v: number) => void; error?: boolean; small?: boolean
  min: number; max: number; note?: string
}) {
  const v = value ?? min
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const wide = max >= 1000
  return (
    <div id={`q-${id}`} className={`rounded-2xl p-3 ${error ? "bg-red-50 ring-2 ring-red-500" : ""}`}>
      <label htmlFor={`in-${id}`} className={`${small ? "text-base font-semibold" : "text-lg font-bold"} block mb-2`}>{label}</label>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Kurangi" onClick={() => onChange(clamp(v - 1))}
          className="w-14 h-14 rounded-xl bg-white border-2 border-gray-300 flex items-center justify-center"><Minus className="w-6 h-6" /></button>
        <input id={`in-${id}`} type="number" inputMode="numeric" min={min} max={max} value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          onBlur={() => { if (Number.isFinite(value)) onChange(clamp(value!)) }}
          className={`${wide ? "w-28" : "w-24"} h-14 rounded-xl border-2 border-gray-300 text-center text-2xl font-bold`} />
        <button type="button" aria-label="Tambah" onClick={() => onChange(clamp(v + 1))}
          className="w-14 h-14 rounded-xl bg-white border-2 border-gray-300 flex items-center justify-center"><Plus className="w-6 h-6" /></button>
        {unit && <span className="text-lg text-gray-700">{unit}</span>}
      </div>
      {note && <p className="mt-2 text-base text-gray-600">{note}</p>}
    </div>
  )
}

function Choice({ id, label, value, options, onChange, error }: {
  id: QuestionId; label: string; value?: number; options: [number, string][]; onChange: (v: number) => void; error?: boolean
}) {
  return (
    <fieldset id={`q-${id}`} className={`space-y-2 rounded-2xl p-3 ${error ? "bg-red-50 ring-2 ring-red-500" : ""}`}>
      <legend className="text-lg font-bold">{label}</legend>
      <div className="grid gap-2">
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`min-h-14 rounded-xl border-2 px-4 text-left text-lg font-semibold ${
              value === v ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300"}`}>
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Pantai asal: the beach the app opens on and the beach push alerts are sent for.
 * Saved as soon as it is tapped.
 */
function HomeBeachChooser({ required = false, showError = false }: { required?: boolean; showError?: boolean }) {
  const [home, setHome] = useHomeBeach()
  return (
    <fieldset className="space-y-2 rounded-2xl bg-white border-2 border-sky-200 p-4">
      <legend className="flex items-center gap-2 text-lg font-bold px-1">
        <Home className="w-5 h-5 text-sky-800" aria-hidden /> Pantai asal Anda
      </legend>
      <p className="text-base text-gray-700">
        Aplikasi akan selalu dibuka di pantai ini, dan notifikasi dikirim untuk pantai ini. Anda tetap bisa melihat pantai lain.
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pantai asal">
        {BEACH_LOCATIONS.map((b) => {
          const on = home === b.value
          return (
            <button key={b.value} type="button" role="radio" aria-checked={on} onClick={() => setHome(b.value)}
              className={`min-h-14 rounded-xl border-2 px-3 text-left ${on ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300"}`}>
              <span className="block text-base font-bold leading-tight">{b.label.replace("Pantai ", "")}</span>
              <span className={`block text-xs ${on ? "text-sky-100" : "text-gray-500"}`}>{b.region}</span>
            </button>
          )
        })}
      </div>
      {required && !home ? (
        <p className={`text-base ${showError ? "font-semibold text-red-700" : "text-gray-600"}`}>Pilih pantai asal Anda untuk mendaftar.</p>
      ) : home && !required ? (
        <button type="button" onClick={() => setHome(null)} className="min-h-11 text-base font-semibold text-sky-800">
          Hapus pantai asal (pakai lokasi GPS)
        </button>
      ) : !home ? (
        <p className="text-sm text-gray-600">Belum dipilih: aplikasi memakai lokasi GPS untuk memilih pantai terdekat.</p>
      ) : null}
    </fieldset>
  )
}
