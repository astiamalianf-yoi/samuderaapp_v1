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
