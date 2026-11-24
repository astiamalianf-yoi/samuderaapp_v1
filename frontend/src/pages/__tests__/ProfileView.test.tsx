import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("../../components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { ProfilePage } from "../ProfilePage"
import { REGISTRATION_KEY } from "../../lib/registration"

const activity = { reports_30d: 3, reports_min_3m: 0, signs_12m: ["Wn-3"], incident_hazards: [], interaction_incidents: 0, incidents_total: 1, channels_30d: { app: 3, whatsapp: 0 } }
const answers = [
  { key: "usage_frequency", value: 10, min: 8, max: 12 },
  { key: "lik_combination_count", value: 5 },
  { key: "usage_duration", value: 18 },
  { key: "disaster_interaction", value: 3 },
  { key: "disaster_experience_count", value: 1 },
  { key: "age", value: 40 },
  { key: "fishing_experience", value: 18 },
  { key: "fishing_role", value: 1 },
  { key: "fishing_duration", value: 1 },
  { key: "head_of_community", value: 0 },
]
const top = [
  { key: "usage_frequency", push: "up", contribution: 0.098 },
  { key: "lik_combination_count", push: "down", contribution: -0.049 },
  { key: "disaster_interaction", push: "up", contribution: 0.015 },
  { key: "age", push: "up", contribution: 0.012 },
  { key: "fishing_role", push: "down", contribution: -0.009 },
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
  it("shows the overall result, his top five reasons (as in Paper 2) and all answers, never the class words", async () => {
    mockMe({ profile_view: { overall: "inaction", basis: "random_forest", top, answers, summary: { base: 0.48, answersTotal: 0.06, contributions: { usage_frequency: 0.098, lik_combination_count: -0.049, disaster_interaction: 0.015, age: 0.012, fishing_role: -0.009, usage_duration: -0.004, head_of_community: -0.003 }, mean: 0.52, signsUp: 3, signsTotal: 10, threshold: 0.6, perSign: [{ code: "Wn-3", p: 0.7 }, { code: "Wn-2", p: 0.41 }] } } })
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    const box = await screen.findByLabelText("Profil Anda")
    expect(box.getAttribute("data-overall")).toBe("inaction")
    expect(box.className).toContain("bg-amber-50")
    expect(screen.getByTestId("profile-overall").textContent).toContain("perlu perhatian")
    expect(screen.getByTestId("profile-overall").textContent).not.toContain("Keseluruhan")
    const items = screen.getByTestId("profile-top").querySelectorAll("li")
    expect(items).toHaveLength(5)
    expect(items[1].getAttribute("data-push")).toBe("down")
    expect(items[1].textContent).toContain("Jumlah tanda alam yang dipakai")
    expect(items[1].textContent).toContain("5 tanda")
    expect(items[0].textContent).toContain("+9,8 poin (100%)")
    expect(items[1].textContent).toContain("−4,9 poin (50%)")
    expect(items[0].textContent).toContain("titik balik 4,75 kali per bulan")
    expect(items[0].textContent).toContain("≤ 4,75: perlu perhatian · > 4,75: mendukung")
    expect(items[1].textContent).toContain("titik balik 3,5 tanda")
    expect(items[4].textContent).toContain("Pemilik perahu: perlu perhatian · Tekong / nakhoda atau ABK: mendukung")
    const sum = screen.getByTestId("profile-summary").textContent ?? ""
    expect(sum).toContain("52%")
    expect(sum).toContain("(perlu 60%), kurang 8,0 poin, jadi hasilnya “perlu perhatian”")
    expect(sum).toContain("3 dari 10 mencapai 60%")
    // rata-rata + 5 answers + jawaban lain (0.06 - 0.067) + tanda alam (0.52 - 0.48 - 0.06) + peluang
    expect(screen.getByTestId("profile-waterfall").querySelectorAll(":scope > li")).toHaveLength(9)
    const wfTop = screen.getByTestId("profile-waterfall").querySelectorAll(":scope > li")
    expect(wfTop[0].textContent).toContain("48%")
    expect(wfTop[6].textContent).toContain("Jawaban lain (2)")
    expect(wfTop[6].textContent).toContain("Lama memakai tanda")
    expect(wfTop[7].textContent).toContain("sama untuk semua nelayan")
    expect(wfTop[7].textContent).toContain("Pengaruh tanda alam")
    expect(wfTop[7].textContent).toContain("−2,0 poin")
    expect(wfTop[8].textContent).toContain("52%")
    const rows = screen.getByTestId("profile-signs").querySelectorAll("li")
    expect(rows).toHaveLength(2)
    expect(rows[0].getAttribute("data-up")).toBe("true")
    expect(rows[1].textContent).toContain("41%")
    const all = screen.getByTestId("profile-answers")
    expect(all.querySelectorAll("dt")).toHaveLength(10)
    expect(all.textContent).toContain("Pemilik perahu")
    expect(document.body.textContent).not.toMatch(/actionable|inaction/i)
    const order = [...document.querySelectorAll("section")].map((s) => s.getAttribute("aria-label"))
    expect(order.indexOf("Profil Anda")).toBeLessThan(order.indexOf("Aktivitas Anda"))
  })

  it("explains when the home beach has no model yet", async () => {
    mockMe({ profile_view: { overall: "inaction", basis: "no_location_model", top: [], answers } })
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect((await screen.findByTestId("profile-no-model")).textContent).toContain("belum tersedia")
  })

  it("is not shown when the server keeps it hidden", async () => {
    mockMe({})
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText("Aktivitas Anda")).toBeTruthy())
    expect(screen.queryByLabelText("Profil Anda")).toBeNull()
  })
})

describe("Profil: view and edit are separate pages", () => {
  it("a registered fisherman sees his profile and an Ubah profil button, not the form", async () => {
    mockMe({ profile_view: { overall: "actionable", basis: "random_forest", top, answers } })
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    await screen.findByLabelText("Aktivitas Anda")
    expect(screen.queryByLabelText(/Nomor WhatsApp Anda/)).toBeNull()
    expect(screen.getByRole("link", { name: /Ubah profil/ }).getAttribute("href")).toBe("/profil/ubah")
    expect(screen.getByRole("button", { name: /^Keluar dari HP ini$/ })).toBeTruthy()
  })

  it("/profil/ubah holds the form with a way back", async () => {
    mockMe({})
    const { ProfileEditPage } = await import("../ProfilePage")
    render(<MemoryRouter><ProfileEditPage /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Ubah profil" })).toBeTruthy()
    expect(screen.getByLabelText(/Nomor WhatsApp Anda/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Simpan perubahan" })).toBeTruthy()
    expect(screen.getByRole("link", { name: /Kembali ke profil/ }).getAttribute("href")).toBe("/profil")
  })
})

describe("Hapus data saya", () => {
  it("asks first, then deletes on the server, logs out on this phone and says so", async () => {
    const { fireEvent } = await import("@testing-library/react")
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
      new Response(JSON.stringify((init as RequestInit | undefined)?.method === "DELETE"
        ? { ok: true, deleted: true }
        : { ok: true, fisherman: { id: "f1", phoneLast4: "9373", homeBeach: "pantai_lampuuk", profile: null }, activity })))
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    fireEvent.click(await screen.findByText("Hapus data saya"))
    expect(screen.getByText(/tetap disimpan/).textContent).toContain("tanpa nomor")
    fireEvent.click(screen.getByText("Ya, hapus data saya"))
    await waitFor(() => expect(screen.getByText(/Data Anda sudah dihapus/)).toBeTruthy())
    const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE")!
    expect(String(del[0])).toContain("/api/fishermen/me")
    expect(localStorage.getItem(REGISTRATION_KEY)).toBeNull()
    expect(screen.getByText("Daftar sebagai nelayan")).toBeTruthy()
  })
})
