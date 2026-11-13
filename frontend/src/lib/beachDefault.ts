import type { BeachLocation } from "../types/api"
import { BEACH_LOCATIONS } from "../constants/observationData"

/**
 * Which beach the app opens on.
 *
 * 1. The fisherman's home beach (Pantai asal, set on the Profil page), if any.
 * 2. Otherwise the nearest beach from GPS (asked once per visit), if within NEAREST_MAX_KM.
 * 3. Otherwise the last beach viewed.
 *
 * Choosing another beach in the app only changes what is shown until the app is closed
 * (sessionStorage); the next visit opens on the home beach again. Push alerts follow the
 * home beach, so looking at another beach does not change which alerts the phone receives.
 */
export const HOME_BEACH_KEY = "samudra.homeBeach"
/** Set when the user picked a beach by hand in this visit. */
export const CHOSEN_THIS_VISIT_KEY = "samudra.beachChosenThisVisit"
/** Set once the GPS default has been tried in this visit (so the phone asks only once). */
export const GPS_TRIED_KEY = "samudra.beachGpsTried"
export const NEAREST_MAX_KM = 50

export const isBeach = (v: string | null | undefined): v is BeachLocation =>
  !!v && BEACH_LOCATIONS.some((b) => b.value === v)

export function loadHomeBeach(): BeachLocation | null {
  try {
    const v = localStorage.getItem(HOME_BEACH_KEY)
    return isBeach(v) ? v : null
  } catch {
    return null
  }
}

export function saveHomeBeach(beach: BeachLocation | null) {
  try {
    if (beach) localStorage.setItem(HOME_BEACH_KEY, beach)
    else localStorage.removeItem(HOME_BEACH_KEY)
  } catch {
    // storage unavailable: home beach is not kept
  }
  window.dispatchEvent(new Event("samudra-home-beach-changed"))
}

const toRad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in km. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

/** Nearest beach to a GPS position, or null when every beach is farther than maxKm. */
export function nearestBeach(lat: number, lon: number, maxKm = NEAREST_MAX_KM): BeachLocation | null {
  let best: { beach: BeachLocation; km: number } | null = null
  for (const b of BEACH_LOCATIONS) {
    const km = distanceKm(lat, lon, b.lat, b.lon)
    if (!best || km < best.km) best = { beach: b.value, km }
  }
  return best && best.km <= maxKm ? best.beach : null
}

const session = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string) => {
    try {
      sessionStorage.setItem(k, "1")
    } catch {
      // ignore
    }
  },
}

export const choseThisVisit = () => session.get(CHOSEN_THIS_VISIT_KEY) === "1"
export const markChosenThisVisit = () => session.set(CHOSEN_THIS_VISIT_KEY)
export const gpsTriedThisVisit = () => session.get(GPS_TRIED_KEY) === "1"
export const markGpsTried = () => session.set(GPS_TRIED_KEY)

/** Beach to show when a page opens (before any GPS answer). */
export function initialBeach(lastViewed: string | null): BeachLocation {
  if (choseThisVisit() && isBeach(lastViewed)) return lastViewed
  return loadHomeBeach() ?? (isBeach(lastViewed) ? lastViewed : "pantai_depok")
}
