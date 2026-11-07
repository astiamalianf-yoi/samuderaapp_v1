import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { IncidentPage } from "../IncidentPage"
import { REGISTRATION_KEY } from "../../lib/registration"
import { deriveProfile, validateAnswers, type ProfileAnswers } from "../../lib/profile"

const register = () => localStorage.setItem(REGISTRATION_KEY, JSON.stringify({
  token: "t".repeat(43), fishermanId: "f1", phoneLast4: "7890", homeBeach: "pantai_lampuuk", phone: "6281234567890",
}))

beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => vi.restoreAllMocks())

describe("answers by year", () => {
  const a: ProfileAnswers = {
    birth_year: 1981, fishing_start_year: 2001, lik_start_year: 2010, fishing_role: 1, head_of_community: 0,
    fishing_duration: 1, hazards: ["angin_kencang", "badai"] as ProfileAnswers["hazards"], disaster_interaction: 3, lik_combination_count: 2,
    usage_frequency_min: 2, usage_frequency_max: 4,
  }
  it("age and years are computed for the year", () => {
    expect(deriveProfile(a, 2026)).toMatchObject({ age: 45, fishing_experience: 25, usage_duration: 16, disaster_experience_count: 2 })
    expect(deriveProfile(a, 2030).age).toBe(49)
  })
  it("start years before birth are refused", () => {
    expect(validateAnswers({ ...a, fishing_start_year: 1970 }, 2026)).toContain("fishing_start_year")
  })
})

describe("Lapor kejadian / Minta bantuan", () => {
  it("without registration: emergency call buttons and 'Daftar sekarang'", () => {
    render(<MemoryRouter><IncidentPage /></MemoryRouter>)
    expect(screen.getByRole("link", { name: /115/ }).getAttribute("href")).toBe("tel:115")
    expect(screen.getByRole("link", { name: /112/ }).getAttribute("href")).toBe("tel:112")
    expect(screen.getByText("Daftar sekarang")).toBeTruthy()
  })

  it("help request sends type, beach, help flag and his number; shows call buttons after", async () => {
    register()
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 5.49, longitude: 95.24 } } as GeolocationPosition) },
    })
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, incidentId: "i1", helpSent: true, helpReason: null }), { status: 201 }))
    render(<MemoryRouter><IncidentPage /></MemoryRouter>)
    fireEvent.click(screen.getByText("Angin kencang di laut"))
    fireEvent.click(screen.getByRole("switch"))
    expect(screen.getAllByRole("link", { name: /115/ }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText("Kirim permintaan bantuan"))
    await waitFor(() => expect(screen.getByText("Permintaan bantuan terkirim")).toBeTruthy())
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body).toMatchObject({ type: "angin_kencang", needHelp: true, lat: 5.49, lon: 95.24, contactPhone: "6281234567890" })
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/incidents")
  })

  it("an incident without help does not send his number", async () => {
    register()
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, incidentId: "i2", helpSent: false, helpReason: null }), { status: 201 }))
    render(<MemoryRouter><IncidentPage /></MemoryRouter>)
    fireEvent.click(screen.getByText("Badai / hujan lebat"))
    fireEvent.click(screen.getByText("Kirim laporan kejadian"))
    await waitFor(() => expect(screen.getByText("Kejadian tercatat")).toBeTruthy())
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))
    expect(body.needHelp).toBe(false)
    expect(body.detectedBySign).toBeUndefined() // not asked: the server reads it from his own sign reports
    expect(screen.queryByText(/tanda alam sebelum/)).toBeNull()
    expect(body.contactPhone).toBeUndefined()
  })
})

describe("codebook hazards (No. 12)", () => {
  it("old saved keys become codebook codes; gempa is dropped", async () => {
    const { loadAnswers, ANSWERS_KEY } = await import("../../lib/profile")
    localStorage.setItem(ANSWERS_KEY, JSON.stringify({
      birth_year: 1981, fishing_start_year: 2001, lik_start_year: 2010, fishing_role: 1, head_of_community: 0,
      fishing_duration: 1, hazards: ["gelombang_tinggi", "banjir_rob", "gempa"], disaster_interaction: 3,
      lik_combination_count: 2, usage_frequency_min: 2, usage_frequency_max: 4,
    }))
    expect(loadAnswers()!.hazards.sort()).toEqual(["gelombang_ekstrem", "pasang_tinggi"])
  })
})
