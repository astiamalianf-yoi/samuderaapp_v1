import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { trackEvent, wibDay } from "../engagement"
import { REGISTRATION_KEY } from "../registration"

// Usage log for the field study (26 Nov 2026): registered fishermen only, once per WIB day and warning.
const flush = () => new Promise((r) => setTimeout(r, 0))

describe("usage log", () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("sends nothing for someone who is not registered", async () => {
    trackEvent("app_open")
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("sends app_open once per day, and each warning once", async () => {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify({ token: "t".repeat(32), fishermanId: "f1", phoneLast4: "1234", homeBeach: "pantai_lampuuk" }))
    trackEvent("app_open"); await flush()
    trackEvent("app_open"); await flush()
    trackEvent("warning_seen", "pantai_lampuuk:SIAGA:a1", "pantai_lampuuk"); await flush()
    trackEvent("warning_seen", "pantai_lampuuk:SIAGA:a1", "pantai_lampuuk"); await flush()
    trackEvent("warning_seen", "pantai_lampuuk:EKSTREM:a1", "pantai_lampuuk"); await flush()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/fishermen\/me\/events$/)
    expect((init as RequestInit).headers).toMatchObject({ "X-Fisherman-Token": "t".repeat(32) })
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ event: "app_open", ref: "" })
  })

  it("tries again next time when the phone was offline", async () => {
    localStorage.setItem(REGISTRATION_KEY, JSON.stringify({ token: "t".repeat(32), fishermanId: "f1", phoneLast4: "1234", homeBeach: "pantai_lampuuk" }))
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    trackEvent("app_open"); await flush()
    trackEvent("app_open"); await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses the WIB calendar day", () => {
    expect(wibDay(Date.parse("2026-12-04T23:30:00+07:00"))).toBe("2026-12-04")
    expect(wibDay(Date.parse("2026-12-05T00:10:00+07:00"))).toBe("2026-12-05")
  })
})
