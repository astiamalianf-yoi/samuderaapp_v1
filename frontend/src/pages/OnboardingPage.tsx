import { useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft, ArrowRight, BellRing, LifeBuoy, Megaphone, ShieldAlert, UserPlus, UserRound, WifiOff,
} from "lucide-react"
import { markOnboardingDone } from "../lib/onboarding"

interface Slide {
  title: string
  body: ReactNode
  art: ReactNode
}

const Circle = ({ className, children }: { className: string; children: ReactNode }) => (
  <div className={`w-28 h-28 rounded-full flex items-center justify-center ${className}`}>{children}</div>
)

const Feature = ({ icon, text }: { icon: ReactNode; text: string }) => (
  <li className="flex items-center gap-3 text-left text-[14px] leading-snug">
    <span className="w-9 h-9 shrink-0 rounded-xl bg-sky-100 text-sky-900 flex items-center justify-center">{icon}</span>
    {text}
  </li>
)

const SLIDES: Slide[] = [
  {
    title: "Selamat datang di SAMUDRA",
    art: <img src="/192x192.png" alt="Logo SAMUDRA" className="w-28 h-28 rounded-[1.75rem] shadow-lg bg-white" />,
    body: (
      <>
        <p>
          <b>Sistem peringatan dini angin kencang</b> untuk nelayan di Aceh, Yogyakarta dan Jawa Barat.
          SAMUDRA menggabungkan{" "}
          <b>tanda alam</b> yang dilihat nelayan dengan <b>informasi resmi BMKG</b>, supaya Anda tahu kapan aman
          melaut dan apa yang harus dilakukan.
        </p>
      </>
    ),
  },
  {
    title: "Yang bisa Anda lakukan",
    art: (
      <div className="grid grid-cols-4 gap-1.5 w-full max-w-xs" aria-hidden>
        <span className="rounded-2xl bg-emerald-600 text-white text-[10px] font-extrabold tracking-normal h-11 flex items-center justify-center">AMAN</span>
        <span className="rounded-2xl bg-amber-400 text-black text-[10px] font-extrabold tracking-normal h-11 flex items-center justify-center">WASPADA</span>
        <span className="rounded-2xl bg-orange-500 text-white text-[10px] font-extrabold tracking-normal h-11 flex items-center justify-center">SIAGA</span>
        <span className="rounded-2xl bg-red-700 text-white text-[10px] font-extrabold tracking-normal h-11 flex items-center justify-center">BAHAYA</span>
      </div>
    ),
    body: (
      <ul className="space-y-1">
        <Feature icon={<ShieldAlert className="w-5 h-5" aria-hidden />} text="Lihat status pantai Anda dan apa yang harus dilakukan melalui SAMUDRA atau grup WhatsApp" />
        <Feature icon={<UserRound className="w-5 h-5" aria-hidden />} text="Peringatan khusus untuk Anda, sesuai pengalaman dan laporan Anda" />
        <Feature icon={<Megaphone className="w-5 h-5" aria-hidden />} text="Lapor tanda alam dengan 2 sentuhan, atau !lapor di grup WhatsApp" />
        <Feature icon={<LifeBuoy className="w-5 h-5" aria-hidden />} text="Minta bantuan dalam kondisi bahaya dengan mengirimkan koordinat di grup WhatsApp" />
        <Feature icon={<BellRing className="w-5 h-5" aria-hidden />} text="Notifikasi di HP untuk pantai asal Anda" />
        <Feature icon={<WifiOff className="w-5 h-5" aria-hidden />} text="Tetap bisa dipakai saat sinyal lemah" />
      </ul>
    ),
  },
  {
    title: "Mulai sekarang",
    art: <Circle className="bg-sky-900 text-white"><UserPlus className="w-14 h-14" aria-hidden /></Circle>,
    body: (
      <p>
        <b>Daftar sekali</b> dengan nomor WhatsApp untuk bisa melapor dan mendapat peringatan yang sesuai dengan
        pengalaman Anda. Sudah pernah daftar di HP lain? Anda dapat mendaftar kembali dengan <b>nomor yang sama</b>.
      </p>
    ),
  },
]

/**
 * First-run introduction: what SAMUDRA is, who it is for, and its features. Shown once on the
 * first visit to the home page; "Lewati" and the last slide both end it. Warnings are never behind
 * it: a link to a warning (e.g. from a notification) opens directly.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const touchX = useRef<number | null>(null)
  const last = i === SLIDES.length - 1
  const slide = SLIDES[i]

  const finish = (to: string) => {
    markOnboardingDone()
    navigate(to, { replace: true })
  }
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)))

  return (
    <main
      className="h-dvh bg-gradient-to-b from-sky-50 to-white flex flex-col max-w-md mx-auto px-6 pt-4 pb-6"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}
    >
      <div className="flex items-center justify-between min-h-12">
        {i > 0 ? (
          <button onClick={() => go(i - 1)} aria-label="Sebelumnya" className="w-12 h-12 -ml-2 flex items-center justify-center text-sky-900">
            <ArrowLeft className="w-6 h-6" />
          </button>
        ) : <span />}
        {!last && (
          <button onClick={() => finish("/")} className="min-h-12 px-3 text-lg font-semibold text-sky-800">Lewati</button>
        )}
      </div>

      {/* min-h-0 + my-auto: centred when it fits, scrollable from the top when it does not (small phones). */}
      <section className="flex-1 min-h-0 flex flex-col overflow-y-auto" aria-live="polite"
        aria-roledescription="slide" aria-label={`${i + 1} dari ${SLIDES.length}`}>
        <div className="my-auto flex flex-col items-center text-center gap-3 py-2">
          <div className="flex items-center justify-center">{slide.art}</div>
          <h1 className="text-[1.7rem] leading-tight font-black text-gray-900">{slide.title}</h1>
          <div className="text-[17px] text-gray-700 leading-normal">{slide.body}</div>
        </div>
      </section>

      <div className="flex justify-center gap-2 py-4" role="tablist" aria-label="Halaman pengenalan">
        {SLIDES.map((s, n) => (
          <button key={s.title} role="tab" aria-selected={n === i} aria-label={`Halaman ${n + 1}`} onClick={() => go(n)}
            className={`h-3 rounded-full transition-all ${n === i ? "w-8 bg-sky-900" : "w-3 bg-gray-300"}`} />
        ))}
      </div>

      {last ? (
        <div className="space-y-3">
          <button onClick={() => finish("/profil")}
            className="w-full min-h-16 rounded-2xl bg-sky-900 text-white text-xl font-extrabold">Daftar sekarang</button>
          <button onClick={() => finish("/")}
            className="w-full min-h-14 rounded-2xl border-2 border-sky-900 text-sky-900 text-lg font-bold">Lihat peringatan dulu</button>
        </div>
      ) : (
        <button onClick={() => go(i + 1)}
          className="w-full min-h-16 rounded-2xl bg-sky-900 text-white text-xl font-extrabold flex items-center justify-center gap-2">
          Lanjut <ArrowRight className="w-6 h-6" aria-hidden />
        </button>
      )}
    </main>
  )
}
