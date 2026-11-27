import { describe, expect, it } from "vitest"
import { buildWarningMessage, plain } from "../warningMessage"

// Matrix rows 16–19 (agreed 24 Nov 2026): BMKG forecast WASPADA + fishermen's sign, in either order.
const T0 = Date.parse("2026-11-24T01:00:00Z") // 08.00 WIB
const H = 3600_000
const msg = (o: { level: "WASPADA" | "SIAGA"; inaction?: boolean; wind?: number; weather?: string }) =>
  buildWarningMessage({
    beach: "Pantai Lampuuk",
    final: o.level,
    lik: { level: o.level, signs: "Gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat", reporters: 1,
      highTrust: o.level === "SIAGA", inaction: !!o.inaction, startedAt: T0, endsAt: T0 + H },
    bmkg: { official: null, forecastLevel: "WASPADA", windKmh: o.wind ?? 9, weather: o.weather ?? "Hujan Ringan", period: { start: T0, end: T0 + 7 * H } },
    channel: "app", personal: true,
  }).map((b) => b.map(plain))

describe("Warning Strategy Matrix rows 16–19: BMKG prakiraan WASPADA + LIK", () => {
  it("row 16: source, end of the forecast window, BMKG agreement line, combined impact", () => {
    const [b1, b2] = msg({ level: "WASPADA" })
    expect(b1).toEqual(["STATUS LAUT HARI INI", "Lokasi: Pantai Lampuuk", "🟡 WASPADA · TANDA ANGIN KENCANG",
      "Sumber: prakiraan BMKG + 1 nelayan Lampuuk", "Mulai 08.00 · berlaku sampai 15.00 WIB"])
    expect(b2[1]).toBe("Prakiraan BMKG sejalan dengan tanda alam nelayan: hujan ringan pada 08.00–15.00 WIB.")
    expect(b2[2]).toBe("Dampak untuk perahu: angin kencang diperkirakan datang; ombak lebih tinggi dari biasa, perahu kecil bisa sulit dikendalikan.")
    expect(b2.join(" ")).not.toContain("BMKG: tidak ada peringatan")
  })
  it("wind 30–45 km/h is named instead of the weather", () => {
    expect(msg({ level: "WASPADA", wind: 35 })[1][1]).toBe("Prakiraan BMKG sejalan dengan tanda alam nelayan: angin ±35 km/jam pada 08.00–15.00 WIB.")
  })
  it("row 18: SIAGA, trusted sign, actions until the end of the forecast window", () => {
    const [b1, b2] = msg({ level: "SIAGA" })
    expect(b1[2]).toBe("🟠 SIAGA · TANDA ANGIN KENCANG")
    expect(b1[3]).toBe("Sumber: prakiraan BMKG + 1 nelayan Lampuuk (tanda alam terpercaya)")
    expect(b1[4]).toBe("Mulai 08.00 · berlaku sampai 15.00 WIB")
    expect(b2).toContain("Untuk Anda: tunda melaut sampai 15.00 WIB. Ikat perahu dan amankan alat tangkap.")
  })
  it("row 19: checklist for an Inaction profile", () => {
    const b2 = msg({ level: "SIAGA", inaction: true })[1]
    expect(b2).toContain("✅ Tunda melaut sampai 15.00 WIB. Ikat perahu dan amankan alat tangkap.")
  })
  it("without a BMKG forecast (rows 4/10) the old wording stays", () => {
    const b = buildWarningMessage({ beach: "Pantai Lampuuk", final: "WASPADA",
      lik: { level: "WASPADA", signs: "X", reporters: 1, highTrust: false, inaction: false, startedAt: T0, endsAt: T0 + H },
      bmkg: { official: null, forecastLevel: "NORMAL", windKmh: 9, weather: "Cerah" }, channel: "app", personal: true }).map((x) => x.map(plain))
    expect(b[0][3]).toBe("Sumber: 1 nelayan Lampuuk")
    expect(b[0][4]).toBe("Mulai 08.00 · berlaku sampai 09.00 WIB")
    expect(b[1][1]).toBe("BMKG: tidak ada peringatan.")
  })
})
