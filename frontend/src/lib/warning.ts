import type { ActiveWarningEvent, RiskLevel, WarningStrategyCode } from "../types/api"
import { getSign } from "../constants/signs"

export interface LevelStyle {
  level: RiskLevel
  label: string // big word shown to the fisherman
  sub: string
  card: string
  badge: string
  emoji: string
}

export const LEVELS: Record<RiskLevel, LevelStyle> = {
  NORMAL: { level: "NORMAL", label: "AMAN", sub: "Tidak ada peringatan", emoji: "✅",
    card: "bg-emerald-50 border-emerald-300 text-emerald-950", badge: "bg-emerald-600 text-white" },
  WASPADA: { level: "WASPADA", label: "WASPADA", sub: "Hati-hati, pantau terus", emoji: "⚠️",
    card: "bg-amber-50 border-amber-400 text-amber-950", badge: "bg-amber-500 text-black" },
  SIAGA: { level: "SIAGA", label: "SIAGA", sub: "Bahaya, siapkan perlindungan", emoji: "🟠",
    card: "bg-orange-50 border-orange-500 text-orange-950", badge: "bg-orange-600 text-white" },
  EKSTREM: { level: "EKSTREM", label: "BAHAYA", sub: "Jangan melaut", emoji: "🛑",
    card: "bg-red-700 border-red-900 text-white", badge: "bg-white text-red-700" },
}

export function toLevel(value: unknown): RiskLevel {
  const v = String(value ?? "").toUpperCase()
  if (v === "EKSTREM" || v === "WASPADA" || v === "SIAGA" || v === "NORMAL") return v
  if (v === "HIGH") return "SIAGA"
  if (v === "MEDIUM") return "WASPADA"
  return "NORMAL"
}

export function eventLevel(ev?: ActiveWarningEvent | null): RiskLevel {
  if (!ev) return "NORMAL"
  return toLevel(ev.decision?.final_risk_level ?? ev.riskLevel ?? ev.ml?.lik_risk_level)
}

/** Short, plain instruction for each warning strategy (paper Table 10). */
export const STRATEGY_HEADLINE: Record<WarningStrategyCode, { title: string; action: string }> = {
  STANDARD: {
    title: "Tanda alam terpercaya terlihat",
    action: "Ikuti tindakan di bawah sebelum melaut.",
  },
  EXTRA_WARNING: {
    title: "Lakukan perlindungan sekarang",
    action: "Jangan hanya berhati-hati: amankan alat tangkap dan sesuaikan jadwal melaut.",
  },
  ENHANCED_MONITORING: {
    title: "Pantau tanda alam lain",
    action: "Tanda ini belum terbukti akurat. Amati tanda lain dan cek BMKG sebelum melaut.",
  },
  MAXIMUM_ALERT: {
    title: "Tunda melaut",
    action: "Amankan alat tangkap dan hubungi Panglima Laot atau ketua kelompok sebelum berangkat.",
  },
}

/** Main protective action: the most protective dominant action among the triggering signs. */
export function mainAction(ev?: ActiveWarningEvent | null): string | null {
  if (!ev) return null
  const order = ["Sesuaikan jadwal melaut", "Amankan alat tangkap", "Berhati-hati"]
  const codes = ev.ml?.active_warning ?? ev.input?.lik_codes ?? []
  const actions = codes.map((c) => getSign(c)?.action).filter((a): a is string => !!a)
  for (const a of order) if (actions.includes(a)) return a
  return null
}
