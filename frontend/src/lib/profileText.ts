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
export const SIDE = {
  actionable: { box: "bg-teal-50 border-teal-500", pill: "bg-teal-600 text-white", word: "mendukung" },
  inaction: { box: "bg-amber-50 border-amber-500", pill: "bg-amber-500 text-white", word: "perlu perhatian" },
} as const

