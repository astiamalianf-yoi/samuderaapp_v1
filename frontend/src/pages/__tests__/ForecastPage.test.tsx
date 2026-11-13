import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

const asked: (string | undefined)[] = []
vi.mock("../../hooks/useWeatherForecast", () => ({
  useAllWeatherForecasts: (adm4?: string) => {
    asked.push(adm4)
    return { data: [], loading: false, error: null }
  },
}))
vi.mock("../../components/layout/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { ForecastPage } from "../ForecastPage"
import { getBeachMeta } from "../../constants/observationData"
import { BEACH_KEY } from "../../lib/profile"

describe("ForecastPage (Per jam)", () => {
  it("opens on the beach chosen on the home page", () => {
    localStorage.setItem(BEACH_KEY, "pantai_lampuuk")
    const { getByRole } = render(<MemoryRouter><ForecastPage /></MemoryRouter>)
    expect((getByRole("combobox") as HTMLSelectElement).value).toBe("pantai_lampuuk")
    expect(asked.at(-1)).toBe(getBeachMeta("pantai_lampuuk")?.adm4Code)
  })
})
