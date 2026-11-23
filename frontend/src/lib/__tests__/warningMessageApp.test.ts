import { describe, expect, it } from "vitest"
import { buildWarningMessage } from "../warningMessage"

const base = {
  beach: "Pantai Lampuuk",
  final: "WASPADA" as const,
  lik: null,
  bmkg: { official: null, forecastLevel: "WASPADA" as const, windKmh: 35 },
  channel: "app" as const,
  reportUrl: "wa.me/6280000000000?text=LAPOR",
}
const lines = (p: Parameters<typeof buildWarningMessage>[0]) => buildWarningMessage(p).flat()

describe("report line stays in the channel the person reads", () => {
  it("unregistered app user presses Lapor in the app and is asked to register", () => {
    const l = lines({ ...base, personal: false })
    expect(l).toContain("Lihat tanda bahaya? Tekan **Lapor**.")
    expect(l.some((x) => x.includes("wa.me"))).toBe(false)
    expect(l).toContain("Daftar agar dapat peringatan khusus untuk Anda.")
  })
  it("registered fisherman presses Lapor, no Daftar line", () => {
    const l = lines({ ...base, personal: true })
    expect(l).toContain("Lihat tanda bahaya? Tekan **Lapor**.")
    expect(l.some((x) => x.startsWith("Daftar"))).toBe(false)
  })
  it("AMAN card for unregistered users also uses Lapor", () => {
    const l = lines({ ...base, final: "NORMAL", bmkg: { official: null, forecastLevel: "NORMAL" }, personal: false })
    expect(l).toContain("Lihat tanda bahaya? Tekan **Lapor**.")
  })
  it("WhatsApp group gets the wa.me link", () => {
    const l = lines({ ...base, channel: "wa", lik: null, final: "SIAGA", bmkg: { official: { event: "Angin kencang", expires: Date.now() + 3600_000 }, forecastLevel: "NORMAL" } })
    expect(l).toContain("Lihat tanda bahaya? Lapor lewat WhatsApp: wa.me/6280000000000?text=LAPOR")
  })
})

describe("forecast window line (matrix row 2)", () => {
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 23, h - 7, m)
  it("shows the BMKG forecast window", () => {
    const l = lines({ ...base, personal: true, now: at(8, 5), bmkg: { ...base.bmkg, period: { start: at(8), end: at(15) } } })
    expect(l).toContain("Prakiraan 08.00–15.00 WIB")
  })
  it("falls back to 'saat ini' without a window", () => {
    const l = lines({ ...base, personal: true, now: at(8, 5) })
    expect(l.some((x) => x === "Prakiraan BMKG saat ini")).toBe(true)
  })
})

describe("AMAN card (matrix row 1)", () => {
  it("no 'Diperbarui' line in the message (the card footer shows it next to Perbarui)", () => {
    const l = lines({ ...base, final: "NORMAL", bmkg: { official: null, forecastLevel: "NORMAL" }, personal: false })
    expect(l.some((x) => /diperbarui/i.test(x))).toBe(false)
    expect(l[l.length - 1]).toBe("Daftar agar dapat peringatan khusus untuk Anda.")
  })
})
