import { API_BASE_URL } from "../constants/reportConstants"
import type { BeachLocation } from "../types/api"

export type VapidKeyResponse = {
  publicKey?: string
  vapidPublicKey?: string
  key?: string
}

const parseVapidKey = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as VapidKeyResponse
    return data.publicKey ?? data.vapidPublicKey ?? data.key ?? ""
  }

  return response.text()
}

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export const pushService = {
  async getVapidPublicKey(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`)
    if (!response.ok) {
      throw new Error("Gagal memuat VAPID public key")
    }

    const key = await parseVapidKey(response)
    if (!key) {
      throw new Error("VAPID public key tidak ditemukan")
    }

    return key
  },

  async subscribe(
    subscription: PushSubscription,
    metadata?: { beach_location?: BeachLocation },
  ): Promise<void> {
    const payload = metadata ? { subscription, metadata } : subscription
    const response = await fetch(`${API_BASE_URL}/api/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let detail = ""
      try {
        detail = await response.text()
      } catch {
        detail = ""
      }
      throw new Error(
        detail
          ? `Gagal menyimpan subscription push: ${detail}`
          : "Gagal menyimpan subscription push",
      )
    }
  },

  async unsubscribe(endpoint: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ endpoint }),
    })

    if (!response.ok) {
      throw new Error("Gagal menghapus subscription push")
    }
  },

  toUint8Array(key: string) {
    return urlBase64ToUint8Array(key)
  },
}
