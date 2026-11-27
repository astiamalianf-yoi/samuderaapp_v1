import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { KnowledgePage } from "../KnowledgePage"
import { liveSigns } from "../../hooks/useTrustIndex"
import { SIGNS, SIGN_SCIENCE } from "../../constants/signs"

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
    await waitFor(() => expect(screen.getByText(/laporan tanda dari nelayan \(aplikasi \+ WhatsApp\)/)).toBeTruthy())
    const high = screen.getByRole("heading", { name: "Sangat dipercaya" }).closest("section")!
    expect(high.textContent).toContain("Cerah tanpa awan")
    fireEvent.click(screen.getByText("Cerah tanpa awan"))
    expect(screen.getByText(/Indeks kepercayaan 60,0/)).toBeTruthy()
    expect(screen.getByText(/15 dari 20 diikuti angin kencang/)).toBeTruthy()
    expect(JSON.parse(localStorage.getItem("samudra.trustIndex")!).signs.length).toBe(17)
  })

  it("each card shows its tier colour and whether it moved since the survey", async () => {
    // Wn-10 unranked -> High (up), Wn-3 High -> Low (down), Wn-8 stays High (same)
    const signs = [row("Wn-10", "High", 60), row("Wn-8", "High", 50), row("Wn-3", "Low", 30),
      ...SIGNS.filter((s) => !["Wn-10", "Wn-3", "Wn-8"].includes(s.code)).map((s) => row(s.code, s.tier, 20))]
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, mode: "adaptive", signs, confirmWindowHours: 24, computedAt: "x" })))
    render(<MemoryRouter><KnowledgePage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/laporan tanda dari nelayan \(aplikasi \+ WhatsApp\)/)).toBeTruthy())
    const card = (name: string) => screen.getByText(name).closest("button")!
    expect(card("Cerah tanpa awan").className).toContain("border-l-sky-700")
    expect(card("Cerah tanpa awan").querySelector("[data-move]")!.getAttribute("data-move")).toBe("up")
    expect(card("Ada kilat").className).toContain("border-l-amber-500")
    expect(card("Ada kilat").textContent).toContain("Turun dari sangat dipercaya sejak survei")
    expect(card("Langit mendung").querySelector("[data-move]")!.getAttribute("data-move")).toBe("same")
  })

  it("waiting reports are shown with the time they are judged", async () => {
    const signs = SIGNS.map((s) => row(s.code, s.tier, 20, s.code === "Wn-4" ? { appReports: 0, appConfirmed: 0, appPending: 2, appPendingUntil: "2026-11-25T02:04:14Z" } : {}))
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true, mode: "adaptive", signs, confirmWindowHours: 24, computedAt: "x" })))
    render(<MemoryRouter><KnowledgePage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/laporan tanda dari nelayan/)).toBeTruthy())
    fireEvent.click(screen.getByText("Ombak besar & rapat"))
    const p = screen.getByTestId("trust-pending").textContent ?? ""
    expect(p).toContain("2 laporan masih menunggu 24 jam untuk dinilai")
    expect(p).toContain("25 Nov")
    expect(p).toContain("09.04 WIB")
  })

  it("each sign has a scientific explanation with an honest evidence level", () => {
    for (const s of SIGNS) expect(SIGN_SCIENCE[s.code]?.text.length).toBeGreaterThan(20)
    expect(SIGN_SCIENCE["Wn-5"].evidence).toBe("belum")
    expect(SIGN_SCIENCE["Wn-1"].text).toContain("cumulonimbus")
  })

  it("short list: 'Belum cukup data' is folded, a tap shows the science and the action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }))
    render(<MemoryRouter><KnowledgePage /></MemoryRouter>)
    expect(screen.queryByText("Paus muncul")).toBeNull()
    fireEvent.click(screen.getByTestId("show-unranked"))
    fireEvent.click(screen.getByText("Lumba-lumba mendekat"))
    expect(screen.getByTestId("sign-science").textContent).toContain("Belum ada penjelasan ilmiah")
    fireEvent.click(screen.getByText("Awan turun"))
    const d = screen.getByTestId("sign-detail").textContent ?? ""
    expect(d).toContain("cumulonimbus")
    expect(d).toContain("Didukung sains")
    expect(d).toContain("Amankan alat tangkap")
    expect(screen.getByText("Paus muncul")).toBeTruthy()
  })

  it("the trust formula opens under 'Cara menilai kepercayaan'", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 500 }))
    render(<MemoryRouter><KnowledgePage /></MemoryRouter>)
    expect(screen.queryByTestId("trust-formula")).toBeNull()
    fireEvent.click(screen.getByText("Cara menilai kepercayaan"))
    fireEvent.click(screen.getByText("Lihat rumus"))
    const f = screen.getByTestId("trust-formula").textContent ?? ""
    expect(f).toContain("75% × Akurasi + 25% × Pemakaian")
    expect(f).toContain("kurang dari 20 catatan")
    expect(f).toContain("setelah 24 jam")
  })
})
