import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ReportFollowupCards } from "../ReportFollowupCards"

const reg = { token: "tok", fishermanId: "f1", phoneLast4: "0001", homeBeach: "pantai_lampuuk" }
const now = Date.now()
const pending = (o = {}) => ({
  reportId: 7, beach: "pantai_lampuuk", signs: ["WN-3"], channel: "WHATSAPP",
  reportedAt: new Date(now - 3600_000).toISOString(), until: new Date(now + 23 * 3600_000).toISOString(),
  needResponse: true, needHazard: true, ...o,
})
const ok = (body: unknown) => new Response(JSON.stringify({ ok: true, ...(body as object) }))

beforeEach(() => vi.restoreAllMocks())

describe("Beranda: questions after his own sign report", () => {
  it("shows two separate cards for a report (also from WhatsApp)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ pending: pending() }))
    render(<MemoryRouter><ReportFollowupCards registration={reg} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId("followup-response")).toBeTruthy())
    expect(screen.getByTestId("followup-hazard")).toBeTruthy()
    expect(screen.getAllByText(/lewat WhatsApp/).length).toBe(2)
    expect(screen.getAllByText("Ada kilat").length).toBe(2)
    const ya = screen.getByText("Ya, lapor kejadian").closest("a")!
    expect(ya.getAttribute("href")).toBe("/kejadian?type=angin_kencang&beach=pantai_lampuuk")
  })

  it("an answered card disappears at once, the other stays", async () => {
    const f = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(ok({ pending: pending() }))
      .mockResolvedValueOnce(ok({ pending: pending({ needResponse: false }) }))
    render(<MemoryRouter><ReportFollowupCards registration={reg} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByTestId("followup-response")).toBeTruthy())
    fireEvent.click(screen.getByText("Amankan alat tangkap"))
    expect(screen.queryByTestId("followup-response")).toBeNull()
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
    expect(JSON.parse(String(f.mock.calls[1][1]?.body))).toEqual({ reportId: 7, kind: "response", value: "secure_gear" })
    expect(screen.getByTestId("followup-hazard")).toBeTruthy()
  })

  it("nothing for an unregistered fisherman or after 24 h", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok({ pending: pending({ until: new Date(now - 1000).toISOString() }) }))
    const { unmount } = render(<MemoryRouter><ReportFollowupCards registration={null} /></MemoryRouter>)
    expect(f).not.toHaveBeenCalled()
    unmount()
    render(<MemoryRouter><ReportFollowupCards registration={reg} /></MemoryRouter>)
    await waitFor(() => expect(f).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByTestId("followup-cards")).toBeNull()
  })
})
