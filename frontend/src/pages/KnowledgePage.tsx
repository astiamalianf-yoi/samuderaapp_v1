import { useState } from "react"
import { AppShell } from "../components/layout/AppShell"
import { SIGNS, TIER_LABEL, type TrustTier } from "../constants/signs"

const TIER_INFO: Record<TrustTier, { title: string; text: string; style: string }> = {
  High: {
    title: "Sangat dipercaya",
    text: "Tanda ini paling sering terbukti benar menurut nelayan Aceh. Jika terlihat, segera lakukan tindakan yang dianjurkan.",
    style: "bg-sky-900 text-white",
  },
  Low: {
    title: "Kurang dipercaya",
    text: "Tanda ini kadang benar, kadang tidak. Jangan hanya mengandalkan tanda ini — perhatikan tanda lain dan cek info BMKG.",
    style: "bg-slate-200 text-slate-900",
  },
  Unranked: {
    title: "Belum cukup data",
    text: "Tanda ini jarang dilaporkan, sehingga belum bisa dinilai. Tetap laporkan jika Anda melihatnya.",
    style: "bg-white text-slate-900 border border-slate-300",
  },
}

/** Pengetahuan Nelayan: the local-knowledge signs, grouped by how trusted they are. */
export function KnowledgePage() {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <AppShell title="Tanda Alam">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black">Pengetahuan nelayan</h1>
          <p className="text-base text-gray-700">
            Tanda-tanda angin kencang dari pengalaman nelayan. Kepercayaan dinilai dari survei 245 nelayan di Aceh.
          </p>
        </div>
        {(["High", "Low", "Unranked"] as TrustTier[]).map((tier) => (
          <section key={tier} className="space-y-3">
            <div className={`rounded-2xl p-4 ${TIER_INFO[tier].style}`}>
              <h2 className="text-xl font-extrabold">{TIER_INFO[tier].title}</h2>
              <p className="text-base mt-1">{TIER_INFO[tier].text}</p>
            </div>
            <ul className="space-y-2">
              {SIGNS.filter((s) => s.tier === tier).map((s) => (
                <li key={s.code}>
                  <button onClick={() => setOpen(open === s.code ? null : s.code)} aria-expanded={open === s.code}
                    className="w-full text-left rounded-2xl bg-white border border-gray-200 p-4 flex gap-3 items-start">
                    <span className="text-4xl" aria-hidden>{s.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-lg font-bold">{s.short}</span>
                      <span className="block text-base text-gray-700">{s.description}</span>
                      {open === s.code && (
                        <span className="block mt-2 text-base">
                          {s.action ? <>Tindakan yang paling sering dilakukan: <b>{s.action}</b>. </> : null}
                          <span className="text-gray-500">({TIER_LABEL[s.tier]} · {s.code})</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  )
}
