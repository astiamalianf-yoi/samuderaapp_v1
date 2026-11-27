import { describe, expect, it, vi } from "vitest"
vi.mock("react-leaflet", () => ({ MapContainer: () => null, Marker: () => null, Popup: () => null, TileLayer: () => null }))
import { popupLines } from "../MapPage"
import type { BeachStatus } from "../../services/reportService"

const base = (o: Partial<BeachStatus> = {}): BeachStatus => ({
  beach: "pantai_lhoknga", level: "NORMAL", lik: null,
  bmkg: { level: "NORMAL", forecastLevel: "NORMAL", warnings: [], weather: "Cerah", windSpeed: 1.4, windDirection: "SW", temperature: 25 },
  ...o,
})
const H = 3600_000, T = Date.parse("2026-11-24T01:00:00Z")

describe("Peta popup follows the Beranda card", () => {
  it("bad-weather forecast: a forecast, not a BMKG warning", () => {
    const r = popupLines(base({ level: "WASPADA", bmkg: { ...base().bmkg, level: "WASPADA", forecastLevel: "WASPADA", weather: "Hujan Ringan", periodStart: T, periodEnd: T + 6 * H } }), "Pantai Lhoknga")
    expect(r.head).toEqual(["🟡 WASPADA · CUACA KURANG BAIK", "Sumber: prakiraan BMKG (belum ada laporan dari nelayan)", "Prakiraan 08.00–14.00 WIB"])
    expect(r.forecast).toBe("Prakiraan BMKG: Hujan Ringan · angin ±1 km/jam dari SW · 25°C")
    expect(JSON.stringify(r)).not.toContain("Peringatan dari BMKG")
  })
  it("AMAN", () => {
    const r = popupLines(base(), "Pantai Lhoknga")
    expect(r.head).toEqual(["🟢 AMAN", "Tidak ada peringatan dari nelayan maupun BMKG saat ini."])
  })
  it("official BMKG warning + trusted sign = BAHAYA, with the card's source and time", () => {
    const r = popupLines(base({ level: "EKSTREM",
      lik: { level: "SIAGA", codes: ["Wn-3"], triggeredAt: T, endsAt: T + 7 * H, reporters: 2, strategy: "STANDARD" },
      bmkg: { ...base().bmkg, level: "SIAGA", warnings: [{ event: "Hujan lebat disertai petir dan angin kencang", expires: T + 7 * H, effective: T }] } }), "Pantai Lhoknga")
    expect(r.head[0]).toBe("🔴 BAHAYA · ANGIN KENCANG")
    expect(r.head[1]).toBe("Sumber: peringatan dini BMKG (resmi) + 2 nelayan Lhoknga (tanda alam terpercaya)")
    expect(r.head[2]).toBe("Mulai 08.00 · berlaku sampai 15.00 WIB")
  })
})
