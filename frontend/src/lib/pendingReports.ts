import { reportService } from "../services/reportService"

/**
 * Backup queue for reports sent without signal while the service worker does not yet control the
 * page (first visit): without it the report would be shown as saved but never sent. The service
 * worker's own queue handles every later visit; this one is sent again when the signal returns.
 */
const KEY = "samudra.pendingReports"
type Pending = Parameters<typeof reportService.submitReport>[0]

function load(): Pending[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function save(list: Pending[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

/** True when the report is not covered by the service worker's queue and was kept here. */
export function keepIfNotQueued(report: Pending): boolean {
  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) return false
  save([...load(), report])
  return true
}

let flushing = false
export async function flushPendingReports(): Promise<number> {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return 0
  flushing = true
  let sent = 0
  try {
    let list = load()
    while (list.length) {
      try {
        await reportService.submitReport(list[0])
      } catch (err) {
        if (err instanceof TypeError) break // still no network
      }
      sent += 1
      list = list.slice(1)
      save(list)
    }
  } finally {
    flushing = false
  }
  return sent
}

export function startPendingReportSync() {
  if (typeof window === "undefined") return
  window.addEventListener("online", () => void flushPendingReports())
  void flushPendingReports()
}
