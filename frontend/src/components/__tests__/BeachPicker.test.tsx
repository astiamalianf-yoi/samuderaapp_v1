import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { BeachPicker } from "../BeachPicker"

describe("BeachPicker", () => {
  it("shows the selected beach in the dropdown next to Pantai Anda", () => {
    render(<BeachPicker value="pantai_pangandaran" onChange={() => {}} homeBeach="pantai_pangandaran" />)
    const select = screen.getByLabelText(/Pantai Anda/) as HTMLSelectElement
    expect(select.value).toBe("pantai_pangandaran")
    expect(select.selectedOptions[0].textContent).toBe("Pangandaran")
    expect(select.querySelector("optgroup[label='Jawa Barat']")).not.toBeNull()
  })

  it("changing the dropdown picks the beach", () => {
    const onChange = vi.fn()
    render(<BeachPicker value="pantai_lampuuk" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Pantai Anda/), { target: { value: "pantai_depok" } })
    expect(onChange).toHaveBeenCalledWith("pantai_depok")
  })

  it("puts the home beach first among the chips", () => {
    render(<BeachPicker value="pantai_lampuuk" onChange={() => {}} homeBeach="pantai_pangandaran" />)
    const chips = screen.getAllByRole("radio")
    expect(chips[0].textContent).toContain("Pangandaran")
  })
})
