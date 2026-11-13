import type { ActiveWarningEvent, RiskLevel, WarningStrategyCode } from "../types/api"
import { getSign } from "../constants/signs"
import type { BmkgData } from "../services/reportService"
import type { WeatherAlertProps } from "../components/WeatherAlertCard"

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

export const LEVEL_ORDER: RiskLevel[] = ["NORMAL", "WASPADA", "SIAGA", "EKSTREM"]

/** Level that a warning strategy stands for on its own (paper matrix). */
export const STRATEGY_LEVEL: Record<WarningStrategyCode, RiskLevel> = {
  STANDARD: "SIAGA",
  EXTRA_WARNING: "SIAGA",
  ENHANCED_MONITORING: "WASPADA",
  MAXIMUM_ALERT: "SIAGA",
}

/**
 * When the card's level is higher than the level of the strategy message shown, a short line
 * that says which side raised it: BMKG and/or the beach's community warning (personal card only).
 * Null when the levels match, or at BAHAYA (that has its own box).
 */
export function levelRaisedReason(params: {
  level: RiskLevel
  strategy: WarningStrategyCode | null | undefined
  bmkgLevel: RiskLevel
  communityLevel: RiskLevel
  personal: boolean
}): string | null {
  const { level, strategy, bmkgLevel, communityLevel, personal } = params
  if (!strategy || level === "EKSTREM") return null
  const rank = (l: RiskLevel) => LEVEL_ORDER.indexOf(l)
  const own = STRATEGY_LEVEL[strategy]
  if (rank(level) <= rank(own)) return null
  const why: string[] = []
  if (rank(bmkgLevel) >= rank(level)) why.push("peringatan BMKG")
  if (personal && rank(communityLevel) >= rank(level)) why.push("peringatan untuk komunitas pantai ini")
  if (!why.length) return null
  const word = LEVELS[level].label
  return `Level ${word} karena ${why.join(" dan ")}. Pesan di atas tetap berlaku untuk tanda ini.`
}
export const maxLevel = (...levels: RiskLevel[]): RiskLevel =>
  levels.reduce((a, b) => (LEVEL_ORDER.indexOf(b) > LEVEL_ORDER.indexOf(a) ? b : a), "NORMAL" as RiskLevel)

/**
 * Fusion of the fishermen's side (LIK) and the BMKG side, same rule as the backend
 * (reassurance.ts, fuseLevels): the higher of the two, and BAHAYA (EKSTREM) when both are at SIAGA.
 */
export function fuseLevels(lik: RiskLevel, bmkg: RiskLevel): RiskLevel {
  const rank = (l: RiskLevel) => LEVEL_ORDER.indexOf(l)
  if (rank(lik) >= rank("SIAGA") && rank(bmkg) >= rank("SIAGA")) return "EKSTREM"
  return maxLevel(lik, bmkg)
}

export interface BmkgAssessment {
  level: RiskLevel
  /** Active BMKG nowcast warnings that cover this beach. */
  warnings: WeatherAlertProps[]
  /** Short reasons in plain Bahasa. */
  reasons: string[]
}

/** Wind limits of the BMKG situation table (km/h); same as the backend. ~16 and ~25 knots. */
export const WIND_WASPADA_KMH = 30
export const WIND_SIAGA_KMH = 46

export const kmhToKnots = (kmh: number) => Math.round(kmh / 1.852)

/**
 * BMKG side of the fusion, same rule as the backend (reassurance.ts, determineBmkgRisk):
 * an official BMKG warning covering the beach or wind >= 46 km/h -> SIAGA;
 * wind >= 30 km/h or a bad-weather forecast alone -> WASPADA; otherwise NORMAL.
 */
export function assessBmkg(bmkg: BmkgData | null, alerts: WeatherAlertProps[], now = Date.now()): BmkgAssessment {
  const warnings = alerts.filter((a) => a.appliesToBeach && (a.expiresAt === undefined || a.expiresAt > now))
  const reasons: string[] = []
  let level: RiskLevel = "NORMAL"
  if (warnings.length) {
    level = "SIAGA"
    reasons.push(`BMKG: ${warnings[0].condition} sampai pukul ${warnings[0].end}`)
  }
  if (bmkg) {
    if (bmkg.windSpeed >= WIND_SIAGA_KMH) {
      level = maxLevel(level, "SIAGA")
      reasons.push(`Angin sangat kencang (${bmkg.windSpeed} km/jam)`)
    } else if (bmkg.windSpeed >= WIND_WASPADA_KMH) {
      level = maxLevel(level, "WASPADA")
      reasons.push(`Angin kencang (${bmkg.windSpeed} km/jam)`)
    } else if (!bmkg.isSafe) {
      level = maxLevel(level, "WASPADA")
      reasons.push(`Prakiraan BMKG: ${bmkg.weather}`)
    }
  }
  return { level, warnings, reasons }
}
