import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { KnowledgePage } from "../KnowledgePage"
import { liveSigns } from "../../hooks/useTrustIndex"
import { SIGNS } from "../../constants/signs"

const row = (code: string, tier: string, ti: number, extra = {}) => ({
  code, tier, trustIndex: ti, accuracy: 80, records: 30, surveyRecords: 17, appRecords: 13, appReports: 20, appConfirmed: 15, ranked: tier !== "Unranked", ...extra,
})

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe("Tanda Alam: live Trust Index", () => {
  it("without the index the paper tiers are used", () => {
    expect(liveSigns(null)).toBe(SIGNS)
  })

  it("a sign that reached enough confirmed reports moves into 'Sangat dipercaya'", async () => {
    const signs = [row("Wn-10", "High", 60), row("Wn-3", "High", 55), ...SIGNS.filter((s) => !["Wn-10", "Wn-3"].includes(s.code)).map((s) => row(s.code, s.tier === "High" ? "High" : s.tier, 20))]
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, mode: "adaptive", signs, confirmWindowHours: 24, computedAt: "x" })))
    render(<MemoryRouter><KnowledgePage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/laporan tanda dari aplikasi/)).toBeTruthy())
    const high = screen.getByText("Sangat dipercaya").closest("section")!
    expect(high.textContent).toContain("Cerah tanpa awan")
    fireEvent.click(screen.getByText("Cerah tanpa awan"))
    expect(screen.getByText(/Indeks kepercayaan 60,0/)).toBeTruthy()
    expect(screen.getByText(/15 diikuti angin kencang/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem("samudra.trustIndex")!).signs.length).toBe(17)
  })
})
