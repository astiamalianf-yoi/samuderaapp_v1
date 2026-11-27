import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import {
  CHOSEN_THIS_VISIT_KEY, GPS_TRIED_KEY, HOME_BEACH_KEY, initialBeach, nearestBeach,
} from "../beachDefault"
import { BEACH_KEY } from "../profile"
import { useSelectedBeach } from "../../hooks/useAppState"

function mockGps(lat: number, lon: number) {
  const getCurrentPosition = vi.fn((ok: PositionCallback) =>
    ok({ coords: { latitude: lat, longitude: lon } } as GeolocationPosition))
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true })
  return getCurrentPosition
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe("nearestBeach", () => {
  it("picks the closest beach within 50 km", () => {
    expect(nearestBeach(5.49, 95.24)).toBe("pantai_lampuuk")          // on Lampuuk beach
    expect(nearestBeach(-7.749, 108.497)).toBe("pantai_batu_karas")   // Batukaras village
    expect(nearestBeach(-7.697, 108.655)).toBe("pantai_pangandaran")
    expect(nearestBeach(-7.70, 108.528)).toBe("pantai_bojongsalawe")
    expect(nearestBeach(-6.2, 106.8)).toBeNull()                      // Jakarta: too far from all
  })
})

describe("initialBeach", () => {
  it("home beach first, then the last beach viewed, then Depok", () => {
    expect(initialBeach(null)).toBe("pantai_depok")
    expect(initialBeach("pantai_samas")).toBe("pantai_samas")
    localStorage.setItem(HOME_BEACH_KEY, "pantai_lampuuk")
    expect(initialBeach("pantai_samas")).toBe("pantai_lampuuk")
  })
  it("a beach picked by hand in this visit wins until the app is closed", () => {
    localStorage.setItem(HOME_BEACH_KEY, "pantai_lampuuk")
    sessionStorage.setItem(CHOSEN_THIS_VISIT_KEY, "1")
    expect(initialBeach("pantai_depok")).toBe("pantai_depok")
  })
})

describe("useSelectedBeach", () => {
  it("opens on the home beach and does not ask for GPS", () => {
    localStorage.setItem(HOME_BEACH_KEY, "pantai_lampuuk")
    localStorage.setItem(BEACH_KEY, "pantai_depok")
    const gps = mockGps(-7.749, 108.497)
    const { result } = renderHook(() => useSelectedBeach())
    expect(result.current[0]).toBe("pantai_lampuuk")
    expect(gps).not.toHaveBeenCalled()
  })

  it("without a home beach, uses the nearest beach from GPS (asked once per visit)", () => {
    const gps = mockGps(-7.749, 108.497)
    const { result } = renderHook(() => useSelectedBeach())
    expect(result.current[0]).toBe("pantai_batu_karas")
    expect(sessionStorage.getItem(GPS_TRIED_KEY)).toBe("1")
    renderHook(() => useSelectedBeach())
    expect(gps).toHaveBeenCalledTimes(1)
  })

  it("choosing another beach by hand is kept for this visit only", () => {
    localStorage.setItem(HOME_BEACH_KEY, "pantai_lampuuk")
    const { result } = renderHook(() => useSelectedBeach())
    act(() => result.current[1]("pantai_depok"))
    expect(result.current[0]).toBe("pantai_depok")
    // next visit (new session): back to the home beach
    sessionStorage.clear()
    const next = renderHook(() => useSelectedBeach())
    expect(next.result.current[0]).toBe("pantai_lampuuk")
  })
})
