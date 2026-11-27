import { useCallback, useEffect, useState } from "react"
import { reportService } from "../services/reportService"
import type { BmkgData } from "../services/reportService"
import type { ActiveReportResponse, BeachLocation, PersonalWarningResponse } from "../types/api"
import { BEACH_KEY, loadProfile, type FishermanProfile } from "../lib/profile"
import { loadRegistration, type Registration } from "../lib/registration"
import {
  choseThisVisit, gpsTriedThisVisit, initialBeach, isBeach, loadHomeBeach, markChosenThisVisit, markGpsTried,
  nearestBeach, saveHomeBeach,
} from "../lib/beachDefault"

const writeLastViewed = (b: BeachLocation) => {
  try {
    localStorage.setItem(BEACH_KEY, b)
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("samudra-beach-changed"))
}

const readLastViewed = () => {
  try {
    return localStorage.getItem(BEACH_KEY)
  } catch {
    return null
  }
}

/**
 * Beach shown in the app, shared between pages. Opens on the home beach (Profil), else the nearest
 * beach from GPS, else the last beach viewed (see lib/beachDefault.ts). A beach picked by hand is
 * kept for this visit only.
 */
export function useSelectedBeach(): [BeachLocation, (b: BeachLocation) => void] {
  const [beach, setBeachState] = useState<BeachLocation>(() => initialBeach(readLastViewed()))

  const setBeach = useCallback((b: BeachLocation) => {
    markChosenThisVisit()
    setBeachState(b)
    writeLastViewed(b)
  }, [])

  useEffect(() => {
    const onChange = () => {
      const saved = readLastViewed()
      if (isBeach(saved)) setBeachState(saved)
    }
    // Setting a new home beach on the Profil page also shows it.
    const onHome = () => {
      const home = loadHomeBeach()
      if (home) writeLastViewed(home)
    }
    window.addEventListener("samudra-beach-changed", onChange)
    window.addEventListener("samudra-home-beach-changed", onHome)
    return () => {
      window.removeEventListener("samudra-beach-changed", onChange)
      window.removeEventListener("samudra-home-beach-changed", onHome)
    }
  }, [])

  // Default for this visit: home beach, else nearest beach by GPS (asked once per visit).
  useEffect(() => {
    if (choseThisVisit()) return
    const home = loadHomeBeach()
    if (home) {
      if (readLastViewed() !== home) writeLastViewed(home)
      return
    }
    if (gpsTriedThisVisit() || typeof navigator === "undefined" || !navigator.geolocation) return
    markGpsTried()
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (choseThisVisit() || loadHomeBeach()) return
        const near = nearestBeach(pos.coords.latitude, pos.coords.longitude)
        if (near) writeLastViewed(near)
      },
      () => {
        // permission refused or no fix: keep the last beach viewed
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    )
  }, [])

  return [beach, setBeach]
}

/** This phone's registration (null = not registered: warnings only, no reporting). */
export function useRegistration(): Registration | null {
  const [reg, setReg] = useState<Registration | null>(() => loadRegistration())
  useEffect(() => {
    const onChange = () => setReg(loadRegistration())
    window.addEventListener("samudra-registration-changed", onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener("samudra-registration-changed", onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return reg
}

/** Home beach from the Profil page (null when not set). */
export function useHomeBeach(): [BeachLocation | null, (b: BeachLocation | null) => void] {
  const [home, setHome] = useState<BeachLocation | null>(() => loadHomeBeach())
  useEffect(() => {
    const onChange = () => setHome(loadHomeBeach())
    window.addEventListener("samudra-home-beach-changed", onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener("samudra-home-beach-changed", onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return [home, saveHomeBeach]
}

export function useProfile(): FishermanProfile | null {
  const [profile, setProfile] = useState<FishermanProfile | null>(() => loadProfile())
  useEffect(() => {
    const onChange = () => setProfile(loadProfile())
    window.addEventListener("samudra-profile-changed", onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener("samudra-profile-changed", onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return profile
}

/** Community warning for a beach, refreshed every 30 s. */
export function useActiveWarning(beach: BeachLocation) {
  const [data, setData] = useState<ActiveReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await reportService.getActiveReports(beach)
      setData(res)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat status")
    } finally {
      setLoading(false)
    }
  }, [beach])

  useEffect(() => {
    setData(null)
    refresh()
    const id = setInterval(() => refresh(true), 30000)
    return () => clearInterval(id)
  }, [refresh])

  return { data, loading, error, updatedAt, refresh }
}

/** Warning strategy computed for this fisherman's own profile (Random Forest, τ = 0.60). */
export function usePersonalWarning(beach: BeachLocation, profile: FishermanProfile | null, alertId?: string) {
  const [personal, setPersonal] = useState<PersonalWarningResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    setPersonal(null)
    if (!profile || !alertId) return
    reportService
      .getPersonalWarning(beach, profile)
      .then((r) => {
        if (!cancelled) setPersonal(r)
      })
      .catch(() => {
        if (!cancelled) setPersonal(null)
      })
    return () => {
      cancelled = true
    }
  }, [beach, profile, alertId])

  return personal
}

export function useBmkg(beach: BeachLocation) {
  const [data, setData] = useState<BmkgData | null>(null)
  useEffect(() => {
    let cancelled = false
    setData(null)
    reportService.getBmkg(beach).then((d) => !cancelled && setData(d)).catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [beach])
  return data
}
