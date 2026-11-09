import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { ProfilePage } from "../ProfilePage"
import { REGISTRATION_KEY } from "../../lib/registration"

const activity = { reports_30d: 3, reports_min_3m: 0, signs_12m: ["Wn-3"], incident_hazards: [], interaction_incidents: 0, incidents_total: 1, channels_30d: { app: 3, whatsapp: 0 } }
const features = [
  { key: "disaster_interaction", value: 1, side: "inaction" },
  { key: "usage_frequency_avg", value: 3, side: "inaction" },
  { key: "age", value: 55, side: "inaction" },
  { key: "usage_duration", value: 25, side: "actionable" },
  { key: "disaster_experience_count", value: 4, side: "inaction" },
]

function mockMe(extra: object) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
    ok: true, fisherman: { id: "f1", phoneLast4: "9373", homeBeach: "pantai_lampuuk", profile: null }, activity, ...extra,
  })))
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(REGISTRATION_KEY, JSON.stringify({ token: "x".repeat(43), fishermanId: "f1", phoneLast4: "9373", homeBeach: "pantai_lampuuk" }))
})
afterEach(() => vi.restoreAllMocks())

describe("Profil Anda", () => {
  it("shows the five factors with colours before Aktivitas Anda, never the class words", async () => {
    mockMe({ profile_view: { overall: "inaction", features } })
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    const box = await screen.findByLabelText("Profil Anda")
    expect(box.getAttribute("data-overall")).toBe("inaction")
    expect(box.className).toContain("bg-amber-50")
    expect(box.querySelectorAll("li")).toHaveLength(5)
    expect(box.querySelector("[data-side='actionable']")!.textContent).toContain("Lama memakai tanda alam")
    expect(box.textContent).toContain("55 tahun")
    expect(document.body.textContent).not.toMatch(/actionable|inaction/i)
    const all = [...document.querySelectorAll("section")].map((s) => s.getAttribute("aria-label"))
    expect(all.indexOf("Profil Anda")).toBeLessThan(all.indexOf("Aktivitas Anda"))
  })

  it("is not shown when the server keeps it hidden", async () => {
    mockMe({})
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText("Aktivitas Anda")).toBeTruthy())
    expect(screen.queryByLabelText("Profil Anda")).toBeNull()
  })
})
