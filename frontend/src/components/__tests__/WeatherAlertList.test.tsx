import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { WeatherAlertList } from "../WeatherAlertList"

const alert = (location: string, appliesToBeach: boolean, expiresAt?: number) => ({
  location, date: "13 November 2026", start: "13.06", end: "16.27", condition: "Hujan Lebat dan Petir",
  forecast: "…", recommendation: "…", appliesToBeach, expiresAt, alertKey: location,
})
const state = (alerts: ReturnType<typeof alert>[]) => ({ alerts, loading: false, error: null }) as never

describe("Peringatan cuaca BMKG on Beranda: this beach only", () => {
  it("leaves out warnings for other districts and ended ones", () => {
    render(<MemoryRouter><WeatherAlertList onlyThisBeach beachLabel="Pantai Lampuuk"
      state={state([alert("Peringatan di Gayo", false), alert("Peringatan lama Aceh Besar", true, Date.now() - 1000)])} /></MemoryRouter>)
    expect(screen.getByText("Tidak ada peringatan cuaca dari BMKG untuk Pantai Lampuuk saat ini.")).toBeTruthy()
    expect(screen.queryByText(/Gayo/)).toBeNull()
  })
  it("shows a warning that covers the beach", () => {
    render(<MemoryRouter><WeatherAlertList onlyThisBeach beachLabel="Pantai Lampuuk"
      state={state([alert("Peringatan di Gayo", false), alert("Peringatan Aceh Besar", true, Date.now() + 3_600_000)])} /></MemoryRouter>)
    expect(screen.getByText(/Peringatan Aceh Besar/)).toBeTruthy()
    expect(screen.queryByText(/Gayo/)).toBeNull()
    expect(screen.getByText("1 / 1")).toBeTruthy()
  })
})
