import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import WeatherAlertCard from "../WeatherAlertCard"

const alert = {
  location: "Hujan Lebat disertai Petir di Aceh", date: "06 November 2026", start: "16.45 WIB", end: "20.06 WIB",
  condition: "Hujan Lebat dan Petir", forecast: "…", recommendation: "…",
}

describe("WeatherAlertCard", () => {
  it("warning for another area: green border and green badge", () => {
    const { container } = render(<MemoryRouter><WeatherAlertCard {...alert} appliesToBeach={false} /></MemoryRouter>)
    const badge = screen.getByText("Wilayah lain, bukan pantai Anda")
    expect(badge.className).toContain("bg-emerald-600")
    expect(container.querySelector("article")!.className).toContain("ring-emerald-500")
  })
  it("warning for this beach: red border and red badge", () => {
    const { container } = render(<MemoryRouter><WeatherAlertCard {...alert} appliesToBeach /></MemoryRouter>)
    expect(screen.getByText("Berlaku untuk pantai Anda").className).toContain("bg-red-600")
    expect(container.querySelector("article")!.className).toContain("ring-red-500")
  })
})
