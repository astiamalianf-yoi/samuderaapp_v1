import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { ReportPage } from "../ReportPage"
import { ProfilePage } from "../ProfilePage"
import { loadRegistration, normalizePhone, REGISTRATION_KEY } from "../../lib/registration"
import { HOME_BEACH_KEY } from "../../lib/beachDefault"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe("normalizePhone (app)", () => {
  it("accepts Indonesian formats", () => {
    expect(normalizePhone("0812 3456 7890")).toBe("6281234567890")
    expect(normalizePhone("+62-812-3456-7890")).toBe("6281234567890")
    expect(normalizePhone("123")).toBeNull()
  })
})

describe("Lapor without registration", () => {
  it("shows 'Daftar dulu untuk melapor' instead of the sign tiles", () => {
    render(<MemoryRouter><ReportPage /></MemoryRouter>)
    expect(screen.getByText("Daftar dulu untuk melapor")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Daftar sekarang" }).getAttribute("href")).toBe("/profil")
  })

  it("shows the sign tiles once registered", () => {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify({
      token: "x".repeat(43), fishermanId: "f1", phoneLast4: "7890", homeBeach: "pantai_lampuuk",
    }))
    render(<MemoryRouter><ReportPage /></MemoryRouter>)
    expect(screen.queryByText("Daftar dulu untuk melapor")).toBeNull()
  })
})

describe("Daftar (Profil page)", () => {
  it("needs number, home beach and consent before sending", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }))
    expect(screen.getByText(/Nomor belum benar/)).toBeTruthy()
    expect(screen.getByText("Pilih pantai asal Anda untuk mendaftar.")).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("registers and keeps only the token and last 4 digits on the phone", async () => {
    localStorage.setItem(HOME_BEACH_KEY, "pantai_lampuuk")
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true, token: "t".repeat(43), created: true,
      fisherman: { id: "f1", phoneLast4: "7890", homeBeach: "pantai_lampuuk", profile: null },
    }), { status: 201 }))
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/Nomor WhatsApp Anda/), { target: { value: "0812 3456 7890" } })
    fireEvent.click(screen.getByRole("button", { name: "Pemilik perahu" }))
    fireEvent.click(screen.getByRole("button", { name: "Tidak" }))
    fireEvent.click(screen.getByRole("button", { name: "Kurang dari 1 hari" }))
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: "Daftar" }))
    await waitFor(() => expect(screen.getByText("Anda sudah terdaftar")).toBeTruthy())

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/api/fishermen/register")
    const sent = JSON.parse(String((init as RequestInit).body))
    expect(sent).toMatchObject({ phone: "0812 3456 7890", homeBeach: "pantai_lampuuk", consent: true })
    expect(Object.keys(sent.profile)).toContain("age")

    const reg = loadRegistration()!
    expect(reg.phoneLast4).toBe("7890")
    expect(JSON.stringify(localStorage)).not.toContain("81234567890")
  })
})
