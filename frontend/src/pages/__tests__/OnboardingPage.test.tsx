import { beforeEach, describe, expect, it } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { OnboardingPage } from "../OnboardingPage"
import { ONBOARDING_KEY, needsOnboarding } from "../../lib/onboarding"
import { REGISTRATION_KEY } from "../../lib/registration"

function renderFlow() {
  return render(
    <MemoryRouter initialEntries={["/mulai"]}>
      <Routes>
        <Route path="/mulai" element={<OnboardingPage />} />
        <Route path="/" element={<p>BERANDA</p>} />
        <Route path="/profil" element={<p>DAFTAR</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())

describe("onboarding", () => {
  it("is needed on the first visit only, and never for a registered phone", () => {
    expect(needsOnboarding()).toBe(true)
    localStorage.setItem(ONBOARDING_KEY, "1")
    expect(needsOnboarding()).toBe(false)
    localStorage.clear()
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify({ token: "x".repeat(43), fishermanId: "f", phoneLast4: "1234", homeBeach: "pantai_depok" }))
    expect(needsOnboarding()).toBe(false)
  })

  it("Lewati goes to the home page and is remembered", () => {
    renderFlow()
    expect(screen.getByText("Selamat datang di SAMUDRA")).toBeTruthy()
    fireEvent.click(screen.getByText("Lewati"))
    expect(screen.getByText("BERANDA")).toBeTruthy()
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1")
  })

  it("Lanjut walks through 3 slides: welcome, features, ending with Daftar", () => {
    renderFlow()
    const titles: string[] = []
    for (let n = 0; n < 10 && !screen.queryByText("Daftar sekarang"); n++) {
      titles.push(screen.getByRole("heading").textContent ?? "")
      fireEvent.click(screen.getByText("Lanjut"))
    }
    expect(titles).toEqual(["Selamat datang di SAMUDRA", "Yang bisa Anda lakukan"])
    expect(screen.queryByText("Lewati")).toBeNull()
    fireEvent.click(screen.getByText("Daftar sekarang"))
    expect(screen.getByText("DAFTAR")).toBeTruthy()
  })
})
