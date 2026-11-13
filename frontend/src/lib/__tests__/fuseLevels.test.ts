import { describe, expect, it } from "vitest"
import { LEVELS, fuseLevels } from "../warning"

describe("fuseLevels (LIK x BMKG)", () => {
  it("uses the higher of the two sources", () => {
    expect(fuseLevels("WASPADA", "NORMAL")).toBe("WASPADA")
    expect(fuseLevels("NORMAL", "SIAGA")).toBe("SIAGA")
    expect(fuseLevels("SIAGA", "WASPADA")).toBe("SIAGA")
  })
  it("raises to BAHAYA when both the fishermen and BMKG are at SIAGA", () => {
    expect(fuseLevels("SIAGA", "SIAGA")).toBe("EKSTREM")
    expect(LEVELS[fuseLevels("SIAGA", "SIAGA")].label).toBe("BAHAYA")
  })
})
