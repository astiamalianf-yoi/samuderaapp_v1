import { useEffect, useState } from "react"
import { API_BASE_URL } from "../config"

let cache: Record<string, string> | null = null

/** Invite link of each beach's WhatsApp group (from the backend's WHATSAPP_GROUP_LINKS). */
export function useWhatsAppGroups(): Record<string, string> {
  const [links, setLinks] = useState<Record<string, string>>(cache ?? {})
  useEffect(() => {
    if (cache) return
    let cancelled = false
    fetch(`${API_BASE_URL}/api/whatsapp/groups`)
      .then((r) => r.json())
      .then((j) => {
        cache = j?.ok && j.data && typeof j.data === "object" ? j.data : {}
        if (!cancelled) setLinks(cache!)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return links
}
