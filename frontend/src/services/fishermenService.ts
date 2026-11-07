import { API_BASE_URL } from "../config"
import type { ProfileAnswers } from "../lib/profile"
import type { BeachLocation } from "../types/api"

export interface PublicFisherman {
  id: string
  phoneLast4: string
  homeBeach: BeachLocation
  profile: ProfileAnswers | null
}

export interface Activity {
  reports_30d: number
  reports_min_3m: number
  signs_12m: string[]
  incidents_total: number
  interaction_incidents: number
  incident_hazards: string[]
  /** Messages logged in the last 30 days per channel (repeats within 5 minutes included). */
  channels_30d?: { app: number; whatsapp: number }
}

export type IncidentType = "angin_kencang" | "gelombang_ekstrem" | "badai" | "arus_kuat"

export class RegistrationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new RegistrationError(body.error ?? `http_${res.status}`, body.message ?? body.error ?? "Gagal")
  return body as T
}

export const fishermenService = {
  async register(input: { phone: string; homeBeach: BeachLocation; profile: ProfileAnswers; consent: true }) {
    const res = await fetch(`${API_BASE_URL}/api/fishermen/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return json<{ ok: true; fisherman: PublicFisherman; token: string; created: boolean }>(res)
  },

  async update(token: string, patch: { homeBeach?: BeachLocation; profile?: ProfileAnswers }) {
    const res = await fetch(`${API_BASE_URL}/api/fishermen/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Fisherman-Token": token },
      body: JSON.stringify(patch),
    })
    return json<{ ok: true; fisherman: PublicFisherman }>(res)
  },

  async me(token: string) {
    const res = await fetch(`${API_BASE_URL}/api/fishermen/me`, { headers: { "X-Fisherman-Token": token } })
    return json<{ ok: true; fisherman: PublicFisherman; activity: Activity }>(res)
  },

  async reportIncident(token: string, body: {
    beach: BeachLocation; type: IncidentType; needHelp: boolean; lat?: number; lon?: number; contactPhone?: string
  }) {
    const res = await fetch(`${API_BASE_URL}/api/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Fisherman-Token": token },
      body: JSON.stringify(body),
    })
    return json<{ ok: true; incidentId: string; helpSent: boolean; helpReason: string | null }>(res)
  },
}
