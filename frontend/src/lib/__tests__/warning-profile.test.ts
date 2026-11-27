import { describe, expect, it } from "vitest"
import { eventLevel, mainAction, toLevel } from "../warning"
import { validateProfile, type FishermanProfile } from "../profile"
import { SIGNS, getSign } from "../../constants/signs"
import type { ActiveWarningEvent } from "../../types/api"

const PROFILE: FishermanProfile = {
  age: 55, fishing_experience: 30, fishing_role: 3, head_of_community: 0, fishing_duration: 1,
  disaster_experience_count: 4, disaster_interaction: 1, lik_combination_count: 2,
  usage_duration: 8, usage_frequency_min: 2, usage_frequency_max: 4,
}

const ev = (over: Partial<ActiveWarningEvent>): ActiveWarningEvent => ({
  decision: { is_actionable: true }, ml: {}, input: { lik_codes: [], beach_location: "pantai_depok" }, ...over,
})

describe("signs", () => {
  it("has the 17 codebook signs with the paper's trust tiers", () => {
    expect(SIGNS).toHaveLength(17)
    expect(SIGNS.filter((s) => s.tier === "High").map((s) => s.code)).toEqual(["Wn-3", "Wn-8", "Wn-1", "Wn-2", "Wn-7"])
    expect(SIGNS.filter((s) => s.tier === "Low").map((s) => s.code)).toEqual(["Wn-13", "Wn-4", "Wn-9", "Wn-6", "Wn-5"])
  })
  it("finds signs regardless of case", () => {
    expect(getSign("WN-3")?.short).toBe("Ada kilat")
  })
})

describe("warning level", () => {
  it("uses the fishermen's own level, not the level fused with BMKG at report time (UAT G-11)", () => {
    expect(eventLevel(ev({ decision: { is_actionable: true, final_risk_level: "EKSTREM" }, riskLevel: "siaga" }))).toBe("SIAGA")
    expect(eventLevel(ev({ decision: { is_actionable: true, final_risk_level: "SIAGA" }, ml: { lik_risk_level: "WASPADA" } } as never))).toBe("WASPADA")
    expect(eventLevel(ev({ decision: { is_actionable: true, final_risk_level: "SIAGA" } }))).toBe("SIAGA")
    expect(eventLevel(ev({ riskLevel: "waspada" }))).toBe("WASPADA")
    expect(toLevel("HIGH")).toBe("SIAGA")
    expect(eventLevel(null)).toBe("NORMAL")
  })
  it("picks the most protective action among the signs", () => {
    expect(mainAction(ev({ ml: { active_warning: ["Wn-2", "Wn-8"] } }))).toBe("Amankan alat tangkap")
    expect(mainAction(ev({ ml: { active_warning: ["Wn-2", "Wn-3"] } }))).toBe("Sesuaikan jadwal melaut")
    expect(mainAction(ev({ ml: { active_warning: ["Wn-15"] } }))).toBeNull()
  })
})

describe("profile validation", () => {
  it("accepts a complete profile", () => {
    expect(validateProfile(PROFILE)).toEqual([])
  })
  it("flags missing, out-of-range and inconsistent answers", () => {
    expect(validateProfile({ ...PROFILE, fishing_role: 7 as 1 })).toContain("fishing_role")
    expect(validateProfile({ ...PROFILE, usage_frequency_min: 9, usage_frequency_max: 3 })).toContain("usage_frequency_max")
    expect(validateProfile({ ...PROFILE, fishing_experience: 70 })).toContain("fishing_experience")
    const rest: Partial<FishermanProfile> = { ...PROFILE }
    delete rest.age
    expect(validateProfile(rest)).toContain("age")
  })
})
