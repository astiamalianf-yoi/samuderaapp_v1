import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

const capLoads: (string | null)[] = []
vi.mock("../../hooks/useWeatherAlerts", () => ({
  useCapAlert: (link: string | null) => {
    capLoads.push(link)
    return link
      ? {
          loading: false,
          alert: {
            location: "Hujan Lebat disertai Petir di Aceh (dimuat ulang)",
            date: "06 November 2026", start: "16.45 WIB", end: "20.06 WIB",
            condition: "Hujan Lebat dan Petir", forecast: "…", recommendation: "…",
          },
        }
      : { loading: false, alert: null }
  },
}))
vi.mock("../../components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { AlertDetailPage } from "../AlertDetailPage"

const aceh = {
  location: "Hujan Lebat disertai Petir di Aceh",
  date: "06 November 2026", start: "16.45 WIB", end: "20.06 WIB",
  condition: "Hujan Lebat dan Petir", forecast: "di sebagian wilayah Aceh", recommendation: "Hindari pohon tinggi",
  alertKey: "https://www.bmkg.go.id/alerts/nowcast/id/CBT20261106001_alert.xml",
}

function renderAt(entry: { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/alerts/:id" element={<AlertDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("AlertDetailPage", () => {
  it("shows the warning the card was showing (Aceh), not a list position of another list", () => {
    renderAt({ pathname: `/alerts/${encodeURIComponent(aceh.alertKey)}`, state: { alert: aceh } })
    expect(screen.getAllByText(/Aceh/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Papua/)).toBeNull()
  })

  it("after a reload (no card state) loads the same warning again from its CAP link", () => {
    capLoads.length = 0
    renderAt({ pathname: `/alerts/${encodeURIComponent(aceh.alertKey)}` })
    expect(capLoads).toContain(aceh.alertKey)
    expect(screen.getAllByText(/Aceh \(dimuat ulang\)/).length).toBeGreaterThan(0)
  })

  it("an old position-only link shows 'not found' instead of a wrong warning", () => {
    renderAt({ pathname: "/alerts/0" })
    expect(screen.getByText("Peringatan Tidak Ditemukan")).toBeTruthy()
  })
})
