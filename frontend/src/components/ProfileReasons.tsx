import { ArrowDown, ArrowUp } from "lucide-react"
import type { ProfileView } from "../services/fishermenService"

import { ANSWER_TEXT, num } from "../lib/profileText"

/** The three answers that moved his result most, with ↑ (to mendukung) or ↓ (to perlu perhatian). */
export function TopReasons({ view, title = "Yang paling memengaruhi hasil Anda:" }: { view: ProfileView; title?: string }) {
  const byKey = Object.fromEntries((view.answers ?? []).map((a) => [a.key, a]))
  const top = (view.top ?? []).filter((t) => byKey[t.key])
  if (top.length === 0) return null
  return (
    <>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <ul className="space-y-2" data-testid="profile-top">
        {top.map((t) => {
          const a = byKey[t.key]
          const up = t.push === "up"
          return (
            <li key={t.key} className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 p-3" data-push={t.push}>
              <span className={`shrink-0 rounded-full p-1 ${up ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"}`} aria-hidden>
                {up ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </span>
              <span className="sr-only">{up ? "mendorong ke mendukung:" : "mendorong ke perlu perhatian:"}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-base text-gray-800 leading-snug">{ANSWER_TEXT[t.key]?.label ?? t.key}</span>
                <span className="block text-base font-bold text-gray-900">{ANSWER_TEXT[t.key]?.show(a) ?? num(a.value)}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1"><ArrowUp className="w-4 h-4 text-teal-700" aria-hidden /> mendorong ke mendukung</span>
        <span className="inline-flex items-center gap-1"><ArrowDown className="w-4 h-4 text-amber-700" aria-hidden /> mendorong ke perlu perhatian</span>
      </p>
    </>
  )
}
