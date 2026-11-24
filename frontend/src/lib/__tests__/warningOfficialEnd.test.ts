import { describe, expect, it } from "vitest"
import { buildWarningMessage, plain } from "../warningMessage"

// Agreed 24 Nov 2026: while an official BMKG warning is active the card is valid until it ends; after that the
// level is worked out again from what is still valid (BAHAYA until 17.30 -> rows 18/19 SIAGA until 18.00 -> AMAN).
const t = (h: number, m = 0) => Date.parse(`2026-11-24T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+07:00`)
const lik = { level: "SIAGA" as const, signs: "Kilat muncul di salah satu sisi langit", reporters: 1, highTrust: true, inaction: false, startedAt: t(14, 59), endsAt: t(18) }
const bmkg = { forecastLevel: "WASPADA" as const, windKmh: 5, weather: "Hujan Lebat dan Petir", period: { start: t(15), end: t(18) } }
const card = (official: boolean) => buildWarningMessage({
  beach: "Pantai Lampuuk", final: official ? "EKSTREM" : "SIAGA", lik,
  bmkg: { ...bmkg, official: official ? { event: "Hujan lebat dan petir", effective: t(14, 33), expires: t(17, 30) } : null },
  channel: "app", personal: true,
}).map((b) => b.map(plain))

describe("official BMKG warning ends before the fishermen's warning", () => {
  it("BAHAYA (rows 12/15) is valid until the BMKG warning ends", () => {
    const [b1, b2] = card(true)
    expect(b1[2]).toBe("🔴 BAHAYA · ANGIN KENCANG")
    expect(b1[4]).toBe("Mulai 14.59 · berlaku sampai 17.30 WIB")
    expect(b2).toContain("Untuk Anda: jangan melaut sampai 17.30 WIB. Ikat perahu dengan kuat dan amankan alat tangkap.")
  })
  it("after 17.30 the card is row 18: SIAGA from the sign and the forecast until 18.00", () => {
    const [b1, b2] = card(false)
    expect(b1[2]).toBe("🟠 SIAGA · TANDA ANGIN KENCANG")
    expect(b1[3]).toBe("Sumber: prakiraan BMKG + 1 nelayan Lampuuk (tanda alam terpercaya)")
    expect(b1[4]).toBe("Mulai 14.59 · berlaku sampai 18.00 WIB")
    expect(b2).toContain("Untuk Anda: tunda melaut sampai 18.00 WIB. Ikat perahu dan amankan alat tangkap.")
  })
})
