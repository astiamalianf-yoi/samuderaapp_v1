import { useState } from "react"
import { Link } from "react-router-dom"
import { Home, Minus, Plus, ShieldCheck } from "lucide-react"
import { AppShell } from "../components/layout/AppShell"
import { BEACH_LOCATIONS } from "../constants/observationData"
import { useHomeBeach } from "../hooks/useAppState"
import { clearProfile, loadProfile, PROFILE_LIMITS, saveProfile, validateProfile, type FishermanProfile } from "../lib/profile"

const HAZARDS = ["Angin kencang", "Gelombang tinggi", "Badai / hujan lebat", "Tsunami", "Gempa", "Banjir rob"]

const DEFAULTS: Partial<FishermanProfile> = {
  age: 40, fishing_experience: 15, usage_duration: 10, disaster_interaction: 0,
  lik_combination_count: 2, usage_frequency_min: 2, usage_frequency_max: 4, disaster_experience_count: 1,
}

/** One-time profile so the Random Forest can tailor warnings to this fisherman. */
export function ProfilePage() {
  const saved = loadProfile()
  const [p, setP] = useState<Partial<FishermanProfile>>(saved ?? DEFAULTS)
  const [hazards, setHazards] = useState<string[]>(() => HAZARDS.slice(0, saved?.disaster_experience_count ?? 1))
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  const set = <K extends keyof FishermanProfile>(k: K, v: FishermanProfile[K]) => setP((cur) => ({ ...cur, [k]: v }))

  const submit = () => {
    const full = { ...p, disaster_experience_count: hazards.length } as FishermanProfile
    const errs = validateProfile(full)
    setErrors(errs)
    if (errs.length) {
      document.getElementById(`q-${errs[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    saveProfile(full)
    setDone(true)
  }

  if (done) {
    return (
      <AppShell title="Profil">
        <div className="flex flex-col items-center text-center gap-4 pt-10">
          <ShieldCheck className="w-20 h-20 text-emerald-600" aria-hidden />
          <h1 className="text-3xl font-black">Profil tersimpan</h1>
          <p className="text-lg max-w-sm">Mulai sekarang, peringatan di aplikasi ini disesuaikan dengan pengalaman Anda.</p>
          <Link to="/" className="w-full max-w-sm min-h-14 flex items-center justify-center rounded-2xl bg-sky-900 text-white text-lg font-bold">Kembali ke beranda</Link>
          <button onClick={() => setDone(false)} className="min-h-12 text-lg font-semibold text-sky-800">Ubah jawaban</button>
        </div>
      </AppShell>
    )
  }

  const err = (k: keyof FishermanProfile) => errors.includes(k)

  return (
    <AppShell title="Profil">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black">Profil nelayan</h1>
          <p className="text-base text-gray-700">
            10 pertanyaan singkat, cukup sekali. Jawaban dipakai untuk memilih peringatan yang paling cocok untuk Anda.
          </p>
          <p className="mt-2 text-sm text-gray-600 bg-white rounded-xl border border-gray-200 p-3">
            🔒 Tidak ada nama atau nomor HP yang diminta. Jawaban disimpan di HP ini dan dikirim ke server Samudra hanya untuk menghitung peringatan.
          </p>
        </div>

        <HomeBeachChooser />

        <Stepper id="age" label="1. Berapa umur Anda?" unit="tahun" value={p.age} onChange={(v) => set("age", v)} error={err("age")} />
        <Stepper id="fishing_experience" label="2. Sudah berapa tahun menjadi nelayan?" unit="tahun"
          value={p.fishing_experience} onChange={(v) => set("fishing_experience", v)} error={err("fishing_experience")} />

        <Choice id="fishing_role" label="3. Apa peran Anda di perahu?" value={p.fishing_role} error={err("fishing_role")}
          options={[[1, "Pemilik perahu"], [2, "Tekong / nakhoda"], [3, "ABK / awak"]]} onChange={(v) => set("fishing_role", v as 1 | 2 | 3)} />
        <Choice id="head_of_community" label="4. Pernah menjadi ketua kelompok nelayan?" value={p.head_of_community} error={err("head_of_community")}
          options={[[1, "Ya"], [0, "Tidak"]]} onChange={(v) => set("head_of_community", v as 0 | 1)} />
        <Choice id="fishing_duration" label="5. Biasanya berapa lama sekali melaut?" value={p.fishing_duration} error={err("fishing_duration")}
          options={[[1, "Kurang dari 1 hari"], [2, "Beberapa hari"], [3, "Beberapa minggu"]]} onChange={(v) => set("fishing_duration", v as 1 | 2 | 3)} />

        <fieldset id="q-disaster_experience_count" className="space-y-2">
          <legend className="text-lg font-bold">6. Bencana apa saja yang pernah Anda alami?</legend>
          <div className="grid grid-cols-2 gap-2">
            {HAZARDS.map((h) => {
              const on = hazards.includes(h)
              return (
                <button key={h} type="button" aria-pressed={on}
                  onClick={() => setHazards((cur) => (on ? cur.filter((x) => x !== h) : [...cur, h]))}
                  className={`min-h-12 rounded-xl border-2 px-3 text-base font-semibold ${on ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300"}`}>
                  {h}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Stepper id="disaster_interaction" label="7. Berapa kali Anda sendiri kena angin kencang berbahaya di laut?" unit="kali"
          value={p.disaster_interaction} onChange={(v) => set("disaster_interaction", v)} error={err("disaster_interaction")} />
        <Stepper id="lik_combination_count" label="8. Berapa macam tanda alam yang biasa Anda pakai?" unit="tanda"
          value={p.lik_combination_count} onChange={(v) => set("lik_combination_count", v)} error={err("lik_combination_count")} />
        <Stepper id="usage_duration" label="9. Sudah berapa tahun Anda memakai tanda alam?" unit="tahun"
          value={p.usage_duration} onChange={(v) => set("usage_duration", v)} error={err("usage_duration")} />

        <div className="space-y-3">
          <p className="text-lg font-bold">10. Dalam sebulan, berapa kali Anda memakai tanda alam?</p>
          <Stepper id="usage_frequency_min" label="Paling sedikit" unit="kali" small
            value={p.usage_frequency_min} onChange={(v) => set("usage_frequency_min", v)} error={err("usage_frequency_min")} />
          <Stepper id="usage_frequency_max" label="Paling banyak" unit="kali" small
            value={p.usage_frequency_max} onChange={(v) => set("usage_frequency_max", v)} error={err("usage_frequency_max")} />
        </div>

        {errors.length > 0 && (
          <p className="rounded-xl bg-red-50 border border-red-300 p-3 text-base text-red-800">
            Ada jawaban yang belum diisi atau belum masuk akal (ditandai merah).
          </p>
        )}

        <button onClick={submit} className="w-full min-h-16 rounded-2xl bg-sky-900 text-white text-xl font-extrabold">Simpan profil</button>
        {saved && (
          <button onClick={() => { clearProfile(); setP(DEFAULTS); setHazards(HAZARDS.slice(0, 1)) }}
            className="w-full min-h-12 rounded-xl border-2 border-gray-300 text-base font-semibold text-gray-700">
            Hapus profil dari HP ini
          </button>
        )}
      </div>
    </AppShell>
  )
}

function Stepper({ id, label, unit, value, onChange, error, small }: {
  id: keyof FishermanProfile; label: string; unit: string; value?: number; onChange: (v: number) => void; error?: boolean; small?: boolean
}) {
  const [min, max] = PROFILE_LIMITS[id]
  const v = value ?? min
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div id={`q-${id}`} className={`rounded-2xl p-3 ${error ? "bg-red-50 ring-2 ring-red-500" : ""}`}>
      <label htmlFor={`in-${id}`} className={`${small ? "text-base font-semibold" : "text-lg font-bold"} block mb-2`}>{label}</label>
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Kurangi" onClick={() => onChange(clamp(v - 1))}
          className="w-14 h-14 rounded-xl bg-white border-2 border-gray-300 flex items-center justify-center"><Minus className="w-6 h-6" /></button>
        <input id={`in-${id}`} type="number" inputMode="numeric" min={min} max={max} value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : clamp(Number(e.target.value)))}
          className="w-24 h-14 rounded-xl border-2 border-gray-300 text-center text-2xl font-bold" />
        <button type="button" aria-label="Tambah" onClick={() => onChange(clamp(v + 1))}
          className="w-14 h-14 rounded-xl bg-white border-2 border-gray-300 flex items-center justify-center"><Plus className="w-6 h-6" /></button>
        <span className="text-lg text-gray-700">{unit}</span>
      </div>
    </div>
  )
}

function Choice({ id, label, value, options, onChange, error }: {
  id: keyof FishermanProfile; label: string; value?: number; options: [number, string][]; onChange: (v: number) => void; error?: boolean
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
 * Saved as soon as it is tapped (separate from the 10 questions, which feed the model).
 */
function HomeBeachChooser() {
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
      {home ? (
        <button type="button" onClick={() => setHome(null)} className="min-h-11 text-base font-semibold text-sky-800">
          Hapus pantai asal (pakai lokasi GPS)
        </button>
      ) : (
        <p className="text-sm text-gray-600">Belum dipilih: aplikasi memakai lokasi GPS untuk memilih pantai terdekat.</p>
      )}
    </fieldset>
  )
}
