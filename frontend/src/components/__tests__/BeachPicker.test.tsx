import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { BeachPicker } from "../BeachPicker"

describe("BeachPicker", () => {
  it("shows the selected beach in the dropdown next to Pantai Anda, no chips", () => {
    render(<BeachPicker value="pantai_pangandaran" onChange={() => {}} homeBeach="pantai_pangandaran" />)
    const select = screen.getByLabelText(/Pantai/) as HTMLSelectElement
    expect(select.value).toBe("pantai_pangandaran")
    expect(select.selectedOptions[0].textContent).toBe("Pangandaran")
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
  })

  it("lists the home beach first under Pantai asal, the rest by region", () => {
    render(<BeachPicker value="pantai_lampuuk" onChange={() => {}} homeBeach="pantai_pangandaran" />)
    const groups = [...document.querySelectorAll("optgroup")].map((g) => g.label)
    expect(groups[0]).toBe("Pantai asal")
    expect(groups).toContain("Aceh")
    const options = [...document.querySelectorAll("option")].map((o) => o.value)
    expect(options[0]).toBe("pantai_pangandaran")
    expect(options.filter((v) => v === "pantai_pangandaran")).toHaveLength(1)
  })

  it("changing the dropdown picks the beach", () => {
    const onChange = vi.fn()
    render(<BeachPicker value="pantai_lampuuk" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Pantai/), { target: { value: "pantai_depok" } })
    expect(onChange).toHaveBeenCalledWith("pantai_depok")
  })
})
