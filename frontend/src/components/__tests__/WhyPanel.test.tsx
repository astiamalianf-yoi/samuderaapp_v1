import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { WhyPanel } from "../WhyPanel"
import type { ActiveWarningEvent, PersonalWarningResponse } from "../../types/api"

const strat = (cls: 0 | 1, code: string, label: string, source = "beach_profile") => ({
  code, label_id: label, label_en: label, message_id: "", trust_tier: "High", behavioral_class: cls,
  behavioral_label: cls ? "Actionable" : "Inaction", behavioral_source: source,
}) as never
const event = {
  ml: {
    signs: [{ code: "Wn-2", trust_tier: "High", ranked: true }],
    warning_strategy: strat(1, "STANDARD", "Peringatan Standar"),
    explanation: {
      summary_id: "Bahaya karena durasi penggunaan (62%)",
      contributions: [{ factor: "usage_duration", label_id: "Durasi Penggunaan", category: "community", weight: 0.62 }],
      community_profile: { beach: "pantai_lampuuk", overall: "Safe", factors: [{ key: "x", label_id: "Durasi Penggunaan", status: "Unsafe" }] },
    },
  },
  reassurance: { agreed: false, shapRisk: "SIAGA", bmkgRisk: "LOW", finalLevel: "SIAGA" },
} as unknown as ActiveWarningEvent
afterEach(() => vi.restoreAllMocks())

describe("Mengapa ada peringatan ini?", () => {
  it("beach warning: explains the community decision", () => {
    render(<MemoryRouter><WhyPanel event={event} /></MemoryRouter>)
    expect(screen.getByText(/komunitas pantai ini/)).toBeTruthy()
    expect(screen.getByText("Peringatan Standar")).toBeTruthy()
    expect(screen.getByText("Faktor paling berpengaruh")).toBeTruthy()
    expect(screen.getByText("AMAN")).toBeTruthy() // BMKG "LOW" shown as AMAN
    expect(screen.queryByText("LOW")).toBeNull()
  })
  it("personal warning: explains HIS strategy and profile, not the beach's", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true, fisherman: { id: "f", phoneLast4: "9373", homeBeach: "pantai_lampuuk", profile: null }, activity: {},
      profile_view: { overall: "inaction", basis: "random_forest", top: [{ key: "disaster_interaction", push: "down" }], answers: [{ key: "disaster_interaction", value: 0 }] },
    })))
    const personal = { ok: true, active: true, warning_strategy: strat(0, "EXTRA_WARNING", "Peringatan Ekstra + Panduan Aksi", "random_forest") } as PersonalWarningResponse
    render(<MemoryRouter><WhyPanel event={event} personal={personal} token={"t".repeat(43)} /></MemoryRouter>)
    expect(screen.getByText(/Untuk tanda ini, profil Anda/)).toBeTruthy()
    expect(screen.getByText("perlu perhatian")).toBeTruthy()
    expect(screen.getByText("Peringatan Ekstra + Panduan Aksi")).toBeTruthy()
    expect(screen.queryByText("Peringatan Standar")).toBeNull()
    expect(screen.queryByText("Faktor paling berpengaruh")).toBeNull()
    expect(screen.queryByText(/Kebiasaan nelayan/)).toBeNull()
    await waitFor(() => expect(screen.getByText("Menghadapi kejadian angin kencang di laut")).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/actionable|inaction/i)
  })
})
