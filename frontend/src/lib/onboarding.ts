import { loadRegistration } from "./registration"

export const ONBOARDING_KEY = "samudra.onboardingDone"

/** The introduction is shown once; a registered phone never needs it. */
export function needsOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) !== "1" && !loadRegistration()
  } catch {
    return false
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1")
  } catch {
    // storage unavailable: the introduction may show again next time
  }
}
