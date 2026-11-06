import { useCallback, useEffect, useState } from "react"
import { reportService } from "../services/reportService"
import type { BmkgData } from "../services/reportService"
import type { ActiveReportResponse, BeachLocation, PersonalWarningResponse } from "../types/api"
import { BEACH_KEY, loadProfile, type FishermanProfile } from "../lib/profile"
import { BEACH_LOCATIONS } from "../constants/observationData"

const isBeach = (v: string | null): v is BeachLocation =>
  !!v && BEACH_LOCATIONS.some((b) => b.value === v)

/** Selected beach, shared between pages and with the service worker (push filtering). */
export function useSelectedBeach(): [BeachLocation, (b: BeachLocation) => void] {
  const [beach, setBeachState] = useState<BeachLocation>(() => {
    try {
      const saved = localStorage.getItem(BEACH_KEY)
      return isBeach(saved) ? saved : "pantai_depok"
    } catch {
      return "pantai_depok"
    }
  })

  const setBeach = useCallback((b: BeachLocation) => {
    setBeachState(b)
    try {
      localStorage.setItem(BEACH_KEY, b)
    } catch {
      // ignore
    }
    navigator.serviceWorker?.controller?.postMessage({ type: "SET_BEACH_PREFERENCE", value: b })
    window.dispatchEvent(new Event("samudra-beach-changed"))
  }, [])

  useEffect(() => {
    const onChange = () => {
      const saved = localStorage.getItem(BEACH_KEY)
      if (isBeach(saved)) setBeachState(saved)
    }
    window.addEventListener("samudra-beach-changed", onChange)
    return () => window.removeEventListener("samudra-beach-changed", onChange)
  }, [])

  return [beach, setBeach]
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
