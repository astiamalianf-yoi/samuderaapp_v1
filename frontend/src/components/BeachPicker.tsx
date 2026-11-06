import { useEffect, useRef } from "react"
import { MapPin } from "lucide-react"
import { BEACH_LOCATIONS } from "../constants/observationData"
import type { BeachLocation } from "../types/api"

const REGION: Record<BeachLocation, string> = {
  pantai_lampuuk: "Aceh",
  pantai_lhoknga: "Aceh",
  pantai_ulee_lheue: "Aceh",
  pantai_depok: "Yogyakarta",
  pantai_samas: "Yogyakarta",
}

/** Large, thumb-friendly beach chooser. */
export function BeachPicker({ value, onChange }: { value: BeachLocation; onChange: (b: BeachLocation) => void }) {
  const activeRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: "nearest", inline: "center" })
  }, [value])
  return (
    <div>
      <p className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-2">
        <MapPin className="w-5 h-5 text-sky-800" aria-hidden /> Pantai Anda
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x" role="radiogroup" aria-label="Pilih pantai">
        {BEACH_LOCATIONS.map((b) => {
          const active = b.value === value
          return (
            <button key={b.value} ref={active ? activeRef : undefined} role="radio" aria-checked={active} onClick={() => onChange(b.value)}
              className={`snap-start shrink-0 min-h-14 px-4 rounded-2xl border-2 text-left ${
                active ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
              <span className="block text-base font-bold leading-tight">{b.label.replace("Pantai ", "")}</span>
              <span className={`block text-xs ${active ? "text-sky-100" : "text-gray-500"}`}>{REGION[b.value]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
