/**
 * Fisherman profile: the 12 fisherman features of the Random Forest (supplementary codebook).
 * Stored on the device only; sent to the backend when asking for a personal warning and
 * attached to the push subscription so push alerts can be personalised.
 */
export interface FishermanProfile {
  age: number
  fishing_experience: number
  fishing_role: 1 | 2 | 3
  head_of_community: 0 | 1
  fishing_duration: 1 | 2 | 3
  disaster_experience_count: number
  disaster_interaction: number
  lik_combination_count: number
  usage_duration: number
  usage_frequency_min: number
  usage_frequency_max: number
}

export const PROFILE_KEY = "samudra_fisherman_profile_v1"

export const PROFILE_LIMITS: Record<keyof FishermanProfile, [number, number]> = {
  age: [10, 100],
  fishing_experience: [0, 80],
  fishing_role: [1, 3],
  head_of_community: [0, 1],
  fishing_duration: [1, 3],
  disaster_experience_count: [0, 6],
  disaster_interaction: [0, 50],
  lik_combination_count: [1, 17],
  usage_duration: [0, 80],
  usage_frequency_min: [0, 60],
  usage_frequency_max: [0, 60],
}

export function validateProfile(p: Partial<FishermanProfile>): string[] {
  const errors: string[] = []
  for (const [key, [min, max]] of Object.entries(PROFILE_LIMITS) as [keyof FishermanProfile, [number, number]][]) {
    const v = p[key]
    if (v === undefined || v === null || Number.isNaN(Number(v))) errors.push(key)
    else if (Number(v) < min || Number(v) > max) errors.push(key)
  }
  if (
    p.usage_frequency_min !== undefined && p.usage_frequency_max !== undefined &&
    Number(p.usage_frequency_min) > Number(p.usage_frequency_max)
  ) errors.push("usage_frequency_max")
  if (p.age !== undefined && p.fishing_experience !== undefined && Number(p.fishing_experience) > Number(p.age)) {
    errors.push("fishing_experience")
  }
  return [...new Set(errors)]
}

export function loadProfile(): FishermanProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as FishermanProfile
    return validateProfile(p).length === 0 ? p : null
  } catch {
    return null
  }
}

export function saveProfile(p: FishermanProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
    window.dispatchEvent(new Event("samudra-profile-changed"))
  } catch {
    // storage unavailable — profile stays for this session only
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY)
    window.dispatchEvent(new Event("samudra-profile-changed"))
  } catch {
    // ignore
  }
}

/** Selected beach is shared between pages. */
export const BEACH_KEY = "samudra_selected_beach"

// ---------------------------------------------------------------------------------------------
// Registration answers (by year). The server keeps them and raises them with activity; the phone
// keeps a copy to fill the form again and to derive a profile when offline.
// ---------------------------------------------------------------------------------------------

export const HAZARD_OPTIONS = [
  ["angin_kencang", "Angin kencang"],
  ["gelombang_tinggi", "Gelombang tinggi"],
  ["badai", "Badai / hujan lebat"],
  ["tsunami", "Tsunami"],
  ["gempa", "Gempa"],
  ["banjir_rob", "Banjir rob"],
] as const
export type HazardKey = (typeof HAZARD_OPTIONS)[number][0]

export interface ProfileAnswers {
  birth_year: number
  fishing_start_year: number
  lik_start_year: number
  fishing_role: 1 | 2 | 3
  head_of_community: 0 | 1
  fishing_duration: 1 | 2 | 3
  hazards: HazardKey[]
  disaster_interaction: number
  lik_combination_count: number
  usage_frequency_min: number
  usage_frequency_max: number
}

export const ANSWERS_KEY = "samudra.profileAnswers"

/** Calendar year in Indonesia (WIB), so age is right around New Year too. */
export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric" }).format(now))
}

/** Question ids that are missing or not plausible (same rules as the server). */
export function validateAnswers(a: Partial<ProfileAnswers>, year = currentYear()): string[] {
  const e: string[] = []
  const ok = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
  if (!ok(a.birth_year, 1920, year - 10)) e.push("birth_year")
  if (!ok(a.fishing_start_year, a.birth_year ?? 1920, year)) e.push("fishing_start_year")
  if (!ok(a.lik_start_year, a.birth_year ?? 1920, year)) e.push("lik_start_year")
  if (!ok(a.fishing_role, 1, 3)) e.push("fishing_role")
  if (!ok(a.head_of_community, 0, 1)) e.push("head_of_community")
  if (!ok(a.fishing_duration, 1, 3)) e.push("fishing_duration")
  if (!ok(a.disaster_interaction, 0, 50)) e.push("disaster_interaction")
  if (!ok(a.lik_combination_count, 1, 17)) e.push("lik_combination_count")
  if (!ok(a.usage_frequency_min, 0, 60)) e.push("usage_frequency_min")
  if (!ok(a.usage_frequency_max, a.usage_frequency_min ?? 0, 60)) e.push("usage_frequency_max")
  return e
}

/** The 12 model inputs from the answers for a given year (without activity; the server adds it). */
export function deriveProfile(a: ProfileAnswers, year = currentYear()): FishermanProfile {
  return {
    age: year - a.birth_year,
    fishing_experience: year - a.fishing_start_year,
    fishing_role: a.fishing_role,
    head_of_community: a.head_of_community,
    fishing_duration: a.fishing_duration,
    disaster_experience_count: a.hazards.length,
    disaster_interaction: a.disaster_interaction,
    lik_combination_count: a.lik_combination_count,
    usage_duration: year - a.lik_start_year,
    usage_frequency_min: a.usage_frequency_min,
    usage_frequency_max: a.usage_frequency_max,
  }
}

export function loadAnswers(): ProfileAnswers | null {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY)
    if (!raw) return null
    const a = JSON.parse(raw) as ProfileAnswers
    return validateAnswers(a).length === 0 ? a : null
  } catch {
    return null
  }
}

/** Keeps the answers and the derived profile (used by older screens) on this phone. */
export function saveAnswers(a: ProfileAnswers | null) {
  try {
    if (a) {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(a))
      saveProfile(deriveProfile(a))
    } else {
      localStorage.removeItem(ANSWERS_KEY)
      clearProfile()
    }
  } catch {
    // storage unavailable
  }
}
