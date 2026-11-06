import type { BeachLocation } from "../types/api"

/**
 * Where each beach is, for deciding whether a BMKG nowcast warning (CAP) covers it.
 * A warning covers the beach when one of its CAP polygons contains the beach, or when
 * its text names the beach's kecamatan or kabupaten/kota. A warning that only names the
 * province (e.g. "Aceh") does not count: BMKG lists the affected districts explicitly.
 */
export const BEACH_AREA: Record<BeachLocation, { lat: number; lon: number; names: string[] }> = {
  pantai_lampuuk: { lat: 5.4833, lon: 95.2333, names: ["Lhoknga", "Aceh Besar"] },
  pantai_lhoknga: { lat: 5.4667, lon: 95.2333, names: ["Lhoknga", "Aceh Besar"] },
  pantai_ulee_lheue: { lat: 5.5583, lon: 95.3083, names: ["Meuraxa", "Banda Aceh"] },
  pantai_depok: { lat: -8.0167, lon: 110.3167, names: ["Kretek", "Bantul"] },
  pantai_samas: { lat: -8.025, lon: 110.3, names: ["Sanden", "Bantul"] },
}

/** CAP polygon text: "lat,lon lat,lon ..." */
export function parseCapPolygon(text: string): [number, number][] {
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number) as [number, number])
    .filter((p) => p.length === 2 && p.every(Number.isFinite))
}

/** Ray casting; points are [lat, lon]. */
export function pointInPolygon(lat: number, lon: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]
    const [yj, xj] = poly[j]
    const crosses = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi
    if (crosses) inside = !inside
  }
  return inside
}

const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, " ")

export function capAppliesToBeach(
  beach: BeachLocation,
  cap: { polygons: string[]; areaDescs: string[]; description: string; headline: string },
): boolean {
  const area = BEACH_AREA[beach]
  for (const p of cap.polygons) {
    const poly = parseCapPolygon(p)
    if (poly.length >= 3 && pointInPolygon(area.lat, area.lon, poly)) return true
  }
  const text = normalise([...cap.areaDescs, cap.description, cap.headline].join(" "))
  return area.names.some((n) => {
    const name = normalise(n)
    // "Banda Aceh" must not match inside "Aceh Besar" text and vice versa — whole-phrase match.
    return new RegExp(`(^|[^a-z])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(text)
  })
}
