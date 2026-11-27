import type { ProfileView } from "../services/fishermenService"

/** His answers as he sees them (labels follow the Ubah profil form). */
const ROLE = { 1: "Pemilik perahu", 2: "Tekong / nakhoda", 3: "ABK / awak" } as Record<number, string>
const TRIP = { 1: "Kurang dari 1 hari", 2: "Beberapa hari", 3: "Beberapa minggu" } as Record<number, string>
export const num = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 })
export const ANSWER_TEXT: Record<string, { label: string; show: (a: ProfileView["answers"][number]) => string }> = {
  usage_frequency: { label: "Memakai tanda alam", show: (a) => `${num(a.value)} kali per bulan` },
  lik_combination_count: { label: "Jumlah tanda alam yang dipakai", show: (a) => `${num(a.value)} tanda` },
  usage_duration: { label: "Lama memakai tanda alam", show: (a) => `${num(a.value)} tahun` },
  disaster_interaction: { label: "Menghadapi kejadian angin kencang di laut", show: (a) => `${num(a.value)} kali` },
  disaster_experience_count: { label: "Jenis bencana yang pernah dialami dan dikenali dari tanda alam", show: (a) => `${num(a.value)} jenis` },
  age: { label: "Usia", show: (a) => `${num(a.value)} tahun` },
  fishing_experience: { label: "Lama menjadi nelayan", show: (a) => `${num(a.value)} tahun` },
  fishing_role: { label: "Peran di perahu", show: (a) => ROLE[a.value] ?? String(a.value) },
  fishing_duration: { label: "Lama sekali melaut", show: (a) => TRIP[a.value] ?? String(a.value) },
  head_of_community: { label: "Pernah menjadi ketua kelompok", show: (a) => (a.value ? "Ya" : "Tidak") },
}
/**
 * Tipping points of the Random Forest of Paper 2 (JISEBI_implementation_RandomForest_Rev.ipynb,
 * Section 8: depth-1 regression tree on −SHAP, fisherman-weighted, 1,000-resample fisherman
 * bootstrap; the top five are Paper 2 Table 8). "unsafe" is the side that pushes towards Inaction
 * ("perlu perhatian"). Lama menjadi nelayan (17.5 years) is left out: its direction holds in only
 * 34% of the resamples, so it is not a usable cutoff.
 */
type Tip = { value: number; unsafe: "le" | "ge"; unit: string } | { point: string; unsafe: string; safe: string }
export const TIPPING: Record<string, Tip> = {
  disaster_interaction: { value: 1.5, unsafe: "le", unit: "kali" },             // 98% stable
  usage_frequency: { value: 4.75, unsafe: "le", unit: "kali per bulan" },        // 100%
  age: { value: 45.5, unsafe: "ge", unit: "tahun" },                             // 98%
  usage_duration: { value: 17.5, unsafe: "le", unit: "tahun" },                  // 88%
  disaster_experience_count: { value: 2.5, unsafe: "ge", unit: "jenis" },        // 100%
  lik_combination_count: { value: 3.5, unsafe: "ge", unit: "tanda" },            // 77%
  fishing_role: { point: "Pemilik / Tekong", unsafe: "Pemilik perahu", safe: "Tekong / nakhoda atau ABK" },          // ≤ 1.5, 91%
  fishing_duration: { point: "Beberapa hari / minggu", unsafe: "Kurang dari 1 hari atau beberapa hari", safe: "Beberapa minggu" }, // ≤ 2.5, 84%
  head_of_community: { point: "Tidak / Ya", unsafe: "Tidak", safe: "Ya" },     // ≤ 0.5, 80%
}
const n2 = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 })
/** e.g. { point: "4,75 kali per bulan", unsafe: "≤ 4,75", safe: "> 4,75" } */
export const tippingText = (key: string) => {
  const t = TIPPING[key]
  if (!t) return null
  if ("point" in t) return t
  const [u, s] = t.unsafe === "le" ? ["≤", ">"] : ["≥", "<"]
  return { point: `${n2(t.value)} ${t.unit}`, unsafe: `${u} ${n2(t.value)}`, safe: `${s} ${n2(t.value)}` }
}
export const SIDE = {
  actionable: { box: "bg-teal-50 border-teal-500", pill: "bg-teal-600 text-white", word: "mendukung" },
  inaction: { box: "bg-amber-50 border-amber-500", pill: "bg-amber-500 text-white", word: "perlu perhatian" },
} as const

