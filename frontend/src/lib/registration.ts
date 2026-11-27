/**
 * Registration of this phone's fisherman (WhatsApp number). Only the server's token and display
 * fields are kept on the phone; the number is sent once, at registration.
 * Reporting a sign needs registration; warnings, BMKG, map and knowledge stay open to everyone.
 */
export interface Registration {
  token: string
  fishermanId: string
  phoneLast4: string
  homeBeach: string
  /** Full WhatsApp number, kept on this phone only (the server keeps a hash), for help requests. */
  phone?: string
}

export const REGISTRATION_KEY = "samudra.registration"

export function loadRegistration(): Registration | null {
  try {
    const raw = localStorage.getItem(REGISTRATION_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as Registration
    return r && typeof r.token === "string" && r.token.length >= 20 ? r : null
  } catch {
    return null
  }
}

export function saveRegistration(r: Registration | null) {
  try {
    if (r) localStorage.setItem(REGISTRATION_KEY, JSON.stringify(r))
    else localStorage.removeItem(REGISTRATION_KEY)
  } catch {
    // storage unavailable
  }
  window.dispatchEvent(new Event("samudra-registration-changed"))
}

/** "0812-3456-7890" / "+62 812…" / "812…" -> "62812…", or null when it is not a valid number. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`
  else if (digits.startsWith("8")) digits = `62${digits}`
  return /^62\d{8,13}$/.test(digits) ? digits : null
}
