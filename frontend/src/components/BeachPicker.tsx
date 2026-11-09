import { ChevronDown, Home, MapPin } from "lucide-react"
import { BEACH_LOCATIONS } from "../constants/observationData"
import type { BeachLocation } from "../types/api"

const short = (label: string) => label.replace("Pantai ", "")

/**
 * Beach chooser: a dropdown next to "Pantai Anda" that always shows the selected beach.
 * The home beach sits at the top under "Pantai asal" and gets a house icon when selected;
 * the other beaches are grouped by region.
 */
export function BeachPicker({ value, onChange, homeBeach = null }: {
  value: BeachLocation; onChange: (b: BeachLocation) => void; homeBeach?: BeachLocation | null
}) {
  const home = BEACH_LOCATIONS.find((b) => b.value === homeBeach)
  const regions = BEACH_LOCATIONS.filter((b) => b.value !== homeBeach).reduce<{ region: string; beaches: typeof BEACH_LOCATIONS }[]>((acc, b) => {
    const g = acc.find((x) => x.region === b.region)
    if (g) g.beaches.push(b)
    else acc.push({ region: b.region, beaches: [b] })
    return acc
  }, [])
  const isHome = value === homeBeach

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor="beach-select" className="flex items-center gap-2 text-base font-semibold text-gray-700 shrink-0">
        <MapPin className="w-5 h-5 text-sky-800" aria-hidden /> <span>Pantai<span className="hidden min-[380px]:inline"> Anda</span></span>
      </label>
      <div className="relative min-w-0 flex-1 max-w-[16rem]">
        {isHome && <Home className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-sky-900" aria-hidden />}
        <select id="beach-select" value={value} onChange={(e) => onChange(e.target.value as BeachLocation)}
          aria-description={isHome ? "Pantai asal" : undefined}
          className={`appearance-none w-full min-h-12 ${isHome ? "pl-8" : "pl-3"} pr-7 rounded-xl border-2 border-sky-900 bg-white text-base font-bold text-sky-900`}>
          {home && (
            <optgroup label="Pantai asal">
              <option value={home.value}>{short(home.label)}</option>
            </optgroup>
          )}
          {regions.map((g) => (
            <optgroup key={g.region} label={g.region}>
              {g.beaches.map((b) => <option key={b.value} value={b.value}>{short(b.label)}</option>)}
            </optgroup>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-900" aria-hidden />
      </div>
    </div>
  )
}
