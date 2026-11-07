import { API_BASE_URL } from "../config"
import type { FishermanProfile } from "../lib/profile"
import type { BeachLocation } from "../types/api"

export interface PublicFisherman {
  id: string
  phoneLast4: string
  homeBeach: BeachLocation
  profile: FishermanProfile | null
}

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
  async register(input: { phone: string; homeBeach: BeachLocation; profile: FishermanProfile; consent: true }) {
    const res = await fetch(`${API_BASE_URL}/api/fishermen/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return json<{ ok: true; fisherman: PublicFisherman; token: string; created: boolean }>(res)
  },

  async update(token: string, patch: { homeBeach?: BeachLocation; profile?: FishermanProfile }) {
    const res = await fetch(`${API_BASE_URL}/api/fishermen/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Fisherman-Token": token },
      body: JSON.stringify(patch),
    })
    return json<{ ok: true; fisherman: PublicFisherman }>(res)
  },
}
