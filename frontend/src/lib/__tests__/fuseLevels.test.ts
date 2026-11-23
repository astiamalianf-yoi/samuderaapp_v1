import { describe, expect, it } from "vitest"
import { LEVELS, fuseLevels } from "../warning"

describe("fuseLevels (LIK x BMKG)", () => {
  it("uses the higher of the two sources", () => {
    expect(fuseLevels("WASPADA", "NORMAL", false)).toBe("WASPADA")
    expect(fuseLevels("NORMAL", "SIAGA", true)).toBe("SIAGA")
    expect(fuseLevels("SIAGA", "WASPADA", false)).toBe("SIAGA")
  })
  it("raises to BAHAYA when the fishermen are at SIAGA and BMKG has an official warning", () => {
    expect(fuseLevels("SIAGA", "SIAGA", true)).toBe("EKSTREM")
    expect(LEVELS[fuseLevels("SIAGA", "SIAGA", true)].label).toBe("BAHAYA")
  })
  it("a BMKG strong-wind forecast alone stays SIAGA (matrix rows 11, 14)", () => {
    expect(fuseLevels("SIAGA", "SIAGA", false)).toBe("SIAGA")
  })
})
