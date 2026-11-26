import { useEffect } from "react"
import { API_BASE_URL } from "../config"
import { loadRegistration } from "./registration"

/**
 * Usage log for the field study (Paper 4, RQ4; 26 Nov 2026): a registered fisherman's app opens,
 * warnings seen, "Mengapa ada peringatan ini?" opened and notifications tapped. Nothing is sent for
 * people who are not registered, and no contents are sent. Each event is sent once per WIB day
 * (and per warning); if the phone is offline it is tried again the next time.
 */
export type UsageEvent = "app_open" | "warning_seen" | "why_open" | "push_click"
const SENT_KEY = "samudra.usage.sent"

export function wibDay(at = Date.now()): string {
  return new Date(at + 7 * 3600_000).toISOString().slice(0, 10)
}

function sentList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "[]") as string[]
  } catch {
    return []
  }
}

export function trackEvent(event: UsageEvent, ref = "", beach?: string): void {
  const reg = loadRegistration()
  if (!reg) return
  const key = `${wibDay()}|${event}|${ref}`
  if (sentList().includes(key)) return
  void fetch(`${API_BASE_URL}/api/fishermen/me/events`, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json", "X-Fisherman-Token": reg.token },
    body: JSON.stringify({ event, ref, ...(beach ? { beach } : {}) }),
  }).then((res) => {
    if (!res.ok) return
    const today = wibDay()
    const list = sentList().filter((k) => k.startsWith(today)) // keep only today's keys
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify([...list, key].slice(-200)))
    } catch {
      // storage full or blocked: the server still keeps one row per day
    }
  }).catch(() => undefined)
}

/** Logs "app_open" when the app is opened or comes back to the front, and a tapped notification. */
export function useUsageLog(): void {
  useEffect(() => {
    const open = () => {
      if (document.visibilityState === "visible") trackEvent("app_open")
    }
    open()
    const params = new URLSearchParams(window.location.search)
    if (params.get("from") === "push") {
      trackEvent("push_click", params.get("ref") ?? "")
      params.delete("from")
      params.delete("ref")
      const q = params.toString()
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash)
    }
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; ref?: string } | null
      if (d?.type === "push-click") trackEvent("push_click", d.ref ?? "")
    }
    document.addEventListener("visibilitychange", open)
    navigator.serviceWorker?.addEventListener("message", onMessage)
    return () => {
      document.removeEventListener("visibilitychange", open)
      navigator.serviceWorker?.removeEventListener("message", onMessage)
    }
  }, [])
}

/** Renders nothing; logs once that this warning was shown to him. */
export function WarningSeen({ refKey, beach }: { refKey: string; beach: string }) {
  useEffect(() => {
    trackEvent("warning_seen", refKey, beach)
  }, [refKey, beach])
  return null
}
