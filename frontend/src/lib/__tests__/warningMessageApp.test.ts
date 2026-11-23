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

describe("app card report line (matrix row 2)", () => {
  it("unregistered user reports through WhatsApp and is asked to register", () => {
    const l = lines({ ...base, personal: false })
    expect(l).toContain("Lihat tanda bahaya? Lapor lewat WhatsApp: wa.me/6280000000000?text=LAPOR")
    expect(l).toContain("Daftar agar dapat peringatan khusus untuk Anda.")
  })
  it("registered fisherman presses Lapor in the app, no Daftar line", () => {
    const l = lines({ ...base, personal: true })
    expect(l).toContain("Lihat tanda bahaya? Tekan **Lapor**.")
    expect(l.some((x) => x.startsWith("Daftar"))).toBe(false)
  })
  it("AMAN card follows the same rule", () => {
    const l = lines({ ...base, final: "NORMAL", bmkg: { official: null, forecastLevel: "NORMAL" }, personal: false })
    expect(l).toContain("Lihat tanda bahaya? Lapor lewat WhatsApp: wa.me/6280000000000?text=LAPOR")
  })
  it("without a bot number the unregistered card falls back to Tekan Lapor", () => {
    const l = lines({ ...base, personal: false, reportUrl: null })
    expect(l).toContain("Lihat tanda bahaya? Tekan **Lapor**.")
  })
})
