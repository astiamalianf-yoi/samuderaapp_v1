import { useEffect, useRef } from "react"
import { ChevronDown, Home, MapPin } from "lucide-react"
import { BEACH_LOCATIONS } from "../constants/observationData"
import type { BeachLocation } from "../types/api"

const short = (label: string) => label.replace("Pantai ", "")

/** Regions in list order, each with its beaches. */
const REGIONS = BEACH_LOCATIONS.reduce<{ region: string; beaches: typeof BEACH_LOCATIONS }[]>((acc, b) => {
  const g = acc.find((x) => x.region === b.region)
  if (g) g.beaches.push(b)
  else acc.push({ region: b.region, beaches: [b] })
  return acc
}, [])

/**
 * Beach chooser: the selected beach is always shown in the dropdown next to "Pantai Anda"
 * (grouped by region), and the chips below allow one-tap switching. The home beach comes first
 * among the chips with a house icon, so it is visible without scrolling.
 */
export function BeachPicker({ value, onChange, homeBeach = null }: {
  value: BeachLocation; onChange: (b: BeachLocation) => void; homeBeach?: BeachLocation | null
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    // Bring the selected chip into view inside its own row only (the page does not jump).
    const row = rowRef.current, chip = activeRef.current
    if (row && chip) row.scrollTo?.({ left: chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" })
  }, [value])

  const chips = homeBeach
    ? [...BEACH_LOCATIONS.filter((b) => b.value === homeBeach), ...BEACH_LOCATIONS.filter((b) => b.value !== homeBeach)]
    : BEACH_LOCATIONS
  const current = BEACH_LOCATIONS.find((b) => b.value === value)

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor="beach-select" className="flex items-center gap-2 text-base font-semibold text-gray-700 shrink-0">
          <MapPin className="w-5 h-5 text-sky-800" aria-hidden /> Pantai Anda
        </label>
        <div className="relative min-w-0">
          <select id="beach-select" value={value} onChange={(e) => onChange(e.target.value as BeachLocation)}
            className="appearance-none w-full max-w-[15rem] min-h-11 pl-3 pr-8 rounded-xl border-2 border-sky-900 bg-white text-base font-bold text-sky-900">
            {REGIONS.map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.beaches.map((b) => (
                  <option key={b.value} value={b.value}>
                    {short(b.label)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-900" aria-hidden />
        </div>
      </div>
      {current && <p className="sr-only" aria-live="polite">{`Pantai dipilih: ${short(current.label)}, ${current.region}`}</p>}
      <div ref={rowRef} className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x" role="radiogroup" aria-label="Pilih pantai">
        {chips.map((b) => {
          const active = b.value === value
          return (
            <button key={b.value} ref={active ? activeRef : undefined} role="radio" aria-checked={active} onClick={() => onChange(b.value)}
              className={`snap-start shrink-0 min-h-14 px-4 rounded-2xl border-2 text-left ${
                active ? "bg-sky-900 border-sky-900 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
              <span className="block text-base font-bold leading-tight">{short(b.label)}</span>
              <span className={`flex items-center gap-1 text-xs ${active ? "text-sky-100" : "text-gray-500"}`}>
                {b.value === homeBeach && <Home className="w-3 h-3" aria-label="Pantai asal" />}
                {b.region}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
