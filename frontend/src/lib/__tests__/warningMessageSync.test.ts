import { describe, expect, it } from "vitest"
import fe from "../warningMessage.ts?raw"
import be from "../../../../disaster-backend/src/lib/warning-message.ts?raw"

// The app card and the WhatsApp group message use the same wording builder (23 Nov 2026).
describe("warning wording is the same in the app and the backend", () => {
  it("frontend/src/lib/warningMessage.ts equals disaster-backend/src/lib/warning-message.ts", () => {
    const strip = (s: string) => s.split("\n").filter((l) => !l.includes("The SAME FILE is kept in")).join("\n")
    expect(strip(fe)).toBe(strip(be))
  })
})
