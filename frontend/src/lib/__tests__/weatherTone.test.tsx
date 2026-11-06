import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Cloud, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react"
import { weatherIcon, weatherTone, windTone } from "../weatherTone"
import { kmhToKnots } from "../warning"
import { BmkgMarineCard } from "../../components/BmkgMarineCard"
import type { BmkgData } from "../../services/reportService"

const base: BmkgData = {
  beach: "pantai_lampuuk", weather: "Berawan", windSpeed: 3, humidity: 89,
  windDirection: "E", temperature: 26, isSafe: true, fetchedAt: 0,
}

describe("weather icon", () => {
  it("matches BMKG descriptions", () => {
    expect(weatherIcon("Berawan")).toBe(Cloud)
    expect(weatherIcon("Cerah Berawan")).toBe(CloudSun)
    expect(weatherIcon("Cerah")).toBe(Sun)
    expect(weatherIcon("Hujan Sedang")).toBe(CloudRain)
    expect(weatherIcon("Hujan Petir")).toBe(CloudLightning)
  })
})

describe("box colours follow the BMKG situation table", () => {
  it("wind: < 30 km/h normal, 30–45 orange (WASPADA), ≥ 46 red (SIAGA)", () => {
    expect(windTone(29.9)).toBe("normal")
    expect(windTone(30)).toBe("waspada")
    expect(windTone(45)).toBe("waspada")
    expect(windTone(46)).toBe("siaga")
    expect(kmhToKnots(30)).toBe(16)
    expect(kmhToKnots(46)).toBe(25)
  })
  it("weather: rain or thunder is orange, cloudy is normal", () => {
    expect(weatherTone(base)).toBe("normal")
    expect(weatherTone({ ...base, weather: "Hujan Ringan", isSafe: false })).toBe("waspada")
    expect(weatherTone({ ...base, weather: "Hujan Petir", isSafe: false })).toBe("waspada")
  })
})

function renderCard(data: BmkgData) {
  return render(<MemoryRouter><BmkgMarineCard data={data} /></MemoryRouter>)
}

describe("BmkgMarineCard", () => {
  it("calm cloudy day: no orange box, Per jam link in the card", () => {
    const { container } = renderCard(base)
    expect(screen.getByText("Cuaca normal")).toBeTruthy()
    expect(screen.getByRole("link", { name: /Per jam/ }).getAttribute("href")).toBe("/forecast")
    expect(container.querySelectorAll('[data-tone="waspada"], [data-tone="siaga"]').length).toBe(0)
    expect(screen.getByText(/Arah: Timur/)).toBeTruthy()
  })
  it("strong wind: only the wind box turns orange, with knots", () => {
    const { container } = renderCard({ ...base, windSpeed: 35 })
    const orange = container.querySelectorAll('[data-tone="waspada"]')
    expect(orange.length).toBe(1)
    expect(orange[0].textContent).toContain("Angin")
    expect(orange[0].textContent).toContain("19 knot")
    expect(screen.getByText("Perlu waspada")).toBeTruthy()
  })
})
