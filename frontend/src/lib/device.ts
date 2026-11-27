const KEY = "samudra.deviceId"

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4000-8000-${Math.random().toString(16).slice(2, 14)}`

/**
 * Anonymous id of this phone, kept in the browser. The server uses it so that the same phone
 * sending the same sign again within 5 minutes is counted once. It contains nothing personal.
 */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = randomId()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return randomId()
  }
}
