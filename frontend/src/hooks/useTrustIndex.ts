import { useEffect, useState } from "react"
import { API_BASE_URL } from "../config"
import { SIGNS, type Sign, type TrustTier } from "../constants/signs"

/** One sign in the live Trust Index (Paper 2, Eq. 2-3; re-estimated with app reports). */
export interface SignTrust {
  code: string
  trustIndex: number
  accuracy: number
  records: number
  surveyRecords: number
  appRecords: number
  appReports: number
  appConfirmed: number
  ranked: boolean
  tier: TrustTier
}
export interface TrustIndex {
  mode: "adaptive" | "paper"
  signs: SignTrust[]
  confirmWindowHours: number
  computedAt: string
}

const KEY = "samudra.trustIndex"

function cached(): TrustIndex | null {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as TrustIndex) : null
    return v && Array.isArray(v.signs) ? v : null
  } catch {
    return null
  }
}

/** The live Trust Index; the last one is kept for offline use. Null until known (use paper tiers). */
export function useTrustIndex(): TrustIndex | null {
  const [value, setValue] = useState<TrustIndex | null>(cached)
  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(() => fetch(`${API_BASE_URL}/api/trust-index`))
      .then((r) => (r && r.ok ? r.json() : null))
      .then((j: (TrustIndex & { ok?: boolean }) | null) => {
        if (!alive || !j || !Array.isArray(j.signs)) return
        const v: TrustIndex = { mode: j.mode, signs: j.signs, confirmWindowHours: j.confirmWindowHours, computedAt: j.computedAt }
        setValue(v)
        try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage full or blocked */ }
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  return value
}

export type LiveSign = Sign & { trust?: SignTrust }

/** The 17 signs with their live tier, ordered by Trust Index (paper order when unknown). */
export function liveSigns(ti: TrustIndex | null): LiveSign[] {
  if (!ti) return SIGNS
  const by = new Map(ti.signs.map((s) => [s.code, s]))
  const order = new Map(ti.signs.map((s, i) => [s.code, i]))
  return SIGNS.map((s) => {
    const t = by.get(s.code)
    return t ? { ...s, tier: t.tier, trust: t } : s
  }).sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99))
}
