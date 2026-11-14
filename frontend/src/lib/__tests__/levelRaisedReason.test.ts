import { describe, expect, it } from "vitest"
import { levelRaisedReason } from "../warning"

describe("levelRaisedReason", () => {
  it("is null when the level matches the strategy", () => {
    expect(levelRaisedReason({ level: "WASPADA", strategy: "ENHANCED_MONITORING", bmkgLevel: "WASPADA", communityLevel: "WASPADA", personal: false })).toBeNull()
    expect(levelRaisedReason({ level: "SIAGA", strategy: "STANDARD", bmkgLevel: "NORMAL", communityLevel: "SIAGA", personal: true })).toBeNull()
  })

  it("names BMKG when BMKG raised Enhanced Monitoring to SIAGA (row 6)", () => {
    expect(levelRaisedReason({ level: "SIAGA", strategy: "ENHANCED_MONITORING", bmkgLevel: "SIAGA", communityLevel: "WASPADA", personal: false }))
      .toBe("Level SIAGA karena peringatan BMKG. Pesan di atas tetap berlaku untuk tanda ini.")
  })

  it("names the community warning for a registered user whose beach class is stricter", () => {
    expect(levelRaisedReason({ level: "SIAGA", strategy: "ENHANCED_MONITORING", bmkgLevel: "NORMAL", communityLevel: "SIAGA", personal: true }))
      .toBe("Level SIAGA karena peringatan untuk komunitas pantai ini. Pesan di atas tetap berlaku untuk tanda ini.")
  })

  it("names both when both raised it", () => {
    expect(levelRaisedReason({ level: "SIAGA", strategy: "ENHANCED_MONITORING", bmkgLevel: "SIAGA", communityLevel: "SIAGA", personal: true }))
      .toContain("peringatan BMKG dan peringatan untuk komunitas pantai ini")
  })

  it("does not mention the community to unregistered users, and stays quiet at BAHAYA", () => {
    expect(levelRaisedReason({ level: "SIAGA", strategy: "ENHANCED_MONITORING", bmkgLevel: "NORMAL", communityLevel: "SIAGA", personal: false })).toBeNull()
    expect(levelRaisedReason({ level: "EKSTREM", strategy: "STANDARD", bmkgLevel: "SIAGA", communityLevel: "SIAGA", personal: true })).toBeNull()
  })
})

describe("levelRaisedReason with the community level taken from the fishermen's own level (UAT E-16)", () => {
  it("names only BMKG when the beach's own warning is WASPADA", () => {
    expect(levelRaisedReason({ level: "SIAGA", strategy: "ENHANCED_MONITORING", bmkgLevel: "SIAGA", communityLevel: "WASPADA", personal: true }))
      .toBe("Level SIAGA karena peringatan BMKG. Pesan di atas tetap berlaku untuk tanda ini.")
  })
})
