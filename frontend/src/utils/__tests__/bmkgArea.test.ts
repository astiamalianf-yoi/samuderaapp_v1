import { describe, expect, it } from "vitest"
import { capAppliesToBeach, pointInPolygon } from "../bmkgArea"
import { assessBmkg } from "../../lib/warning"
import type { WeatherAlertProps } from "../../components/WeatherAlertCard"

const cap = (over: Partial<{ polygons: string[]; areaDescs: string[]; description: string; headline: string }>) => ({
  polygons: [], areaDescs: [], description: "", headline: "", ...over,
})

// The 6 Nov 2026 warning: West Aceh / Pidie districts, not Aceh Besar.
const WEST_ACEH = "Hujan lebat disertai petir akan terjadi di sebagian wilayah Aceh, khususnya di ARONGAN LAMBALEK, BUBON, DANAU PARIS, DARUL HIKMAH, DARUL MAKMUR, GEUMPANG, GUNUNG MERIAH"

describe("capAppliesToBeach", () => {
  it("does not apply a province-wide headline to every beach", () => {
    expect(capAppliesToBeach("pantai_lampuuk", cap({ description: WEST_ACEH, headline: "Peringatan Cuaca Hujan Lebat disertai Petir di Aceh" }))).toBe(false)
  })
  it("applies when the beach's kecamatan or kabupaten is named", () => {
    expect(capAppliesToBeach("pantai_lampuuk", cap({ description: `${WEST_ACEH}, LHOKNGA, LEUPUNG` }))).toBe(true)
    expect(capAppliesToBeach("pantai_depok", cap({ description: "sebagian wilayah Kab. Bantul dan Gunungkidul" }))).toBe(true)
    expect(capAppliesToBeach("pantai_ulee_lheue", cap({ description: "wilayah Aceh Besar" }))).toBe(false)
    expect(capAppliesToBeach("pantai_ulee_lheue", cap({ description: "Kota Banda Aceh" }))).toBe(true)
  })
  it("applies when a CAP polygon contains the beach", () => {
    const box = "5.40,95.10 5.40,95.40 5.60,95.40 5.60,95.10 5.40,95.10"
    expect(capAppliesToBeach("pantai_lampuuk", cap({ polygons: [box] }))).toBe(true)
    expect(capAppliesToBeach("pantai_depok", cap({ polygons: [box] }))).toBe(false)
    expect(pointInPolygon(0, 0, [[1, 1], [1, -1], [-1, -1], [-1, 1]])).toBe(true)
  })
})

const alert = (over: Partial<WeatherAlertProps>): WeatherAlertProps => ({
  location: "Aceh", date: "", start: "16.45 WIB", end: "20.06 WIB", condition: "Hujan Lebat dan Petir",
  forecast: "", recommendation: "", ...over,
})
const calm = { beach: "pantai_lampuuk", weather: "Berawan", windSpeed: 3, windDirection: "E", temperature: 25, isSafe: true, fetchedAt: 0 }

describe("assessBmkg (fusion, BMKG side)", () => {
  it("is NORMAL when nothing applies to the beach", () => {
    expect(assessBmkg(calm, [alert({ appliesToBeach: false })]).level).toBe("NORMAL")
  })
  it("a warning covering the beach makes it SIAGA, even with calm forecast", () => {
    const r = assessBmkg(calm, [alert({ appliesToBeach: true, expiresAt: Date.now() + 3600_000 })])
    expect(r.level).toBe("SIAGA")
    expect(r.reasons[0]).toContain("Hujan Lebat")
  })
  it("ignores an expired warning", () => {
    expect(assessBmkg(calm, [alert({ appliesToBeach: true, expiresAt: Date.now() - 1000 })]).level).toBe("NORMAL")
  })
  it("uses the backend wind thresholds", () => {
    expect(assessBmkg({ ...calm, windSpeed: 35 }, []).level).toBe("WASPADA")
    expect(assessBmkg({ ...calm, windSpeed: 50 }, []).level).toBe("SIAGA")
    expect(assessBmkg({ ...calm, isSafe: false, weather: "Hujan Petir" }, []).level).toBe("SIAGA")
  })
})
