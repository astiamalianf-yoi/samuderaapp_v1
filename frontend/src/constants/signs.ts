/**
 * The 17 local-knowledge strong-wind signs (Wn-1 … Wn-17) of the codebook.
 * Trust tier follows the Trust Index ranking (JISEBI paper, Table 2); unranked signs
 * (< 20 records) are treated as Low-trust by the backend.
 */
export type TrustTier = "High" | "Low" | "Unranked"

export interface Sign {
  code: string // "Wn-3"
  short: string // 2–3 words, shown on the big report button
  description: string // full description from the codebook
  emoji: string
  group: SignGroupId
  tier: TrustTier
  /** Most frequent protective response in the community (Table 2), when ranked. */
  action?: string
}

export type SignGroupId = "langit" | "laut" | "hewan" | "malam" | "angin"

export const SIGN_GROUPS: { id: SignGroupId; label: string; emoji: string }[] = [
  { id: "langit", label: "Langit & Awan", emoji: "☁️" },
  { id: "laut", label: "Laut & Ombak", emoji: "🌊" },
  { id: "angin", label: "Angin & Suara", emoji: "💨" },
  { id: "hewan", label: "Hewan", emoji: "🐬" },
  { id: "malam", label: "Bintang & Bulan", emoji: "🌙" },
]

export const SIGNS: Sign[] = [
  { code: "Wn-3", short: "Ada kilat", emoji: "⚡", group: "langit", tier: "High", action: "Sesuaikan jadwal melaut",
    description: "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi" },
  { code: "Wn-8", short: "Langit mendung", emoji: "🌥️", group: "langit", tier: "High", action: "Amankan alat tangkap",
    description: "Langit mendung namun tidak terlalu gelap" },
  { code: "Wn-1", short: "Awan turun", emoji: "🌫️", group: "langit", tier: "High", action: "Amankan alat tangkap",
    description: "Awan tampak turun ke bawah membentuk gumpalan 3 kali" },
  { code: "Wn-2", short: "Awan bergumpal", emoji: "☁️", group: "langit", tier: "High", action: "Berhati-hati",
    description: "Awan bergumpal dalam beberapa kelompok yang tampak saling mendekat atau menyatu" },
  { code: "Wn-7", short: "Peralihan angin", emoji: "🔄", group: "angin", tier: "High", action: "Berhati-hati",
    description: "Pada masa peralihan angin barat ke angin timur" },
  { code: "Wn-13", short: "Bintang hilang", emoji: "🌑", group: "malam", tier: "Low", action: "Berhati-hati",
    description: "Bintang tidak terlihat di malam hari, saat angin timur" },
  { code: "Wn-4", short: "Ombak besar & rapat", emoji: "🌊", group: "laut", tier: "Low", action: "Amankan alat tangkap",
    description: "Gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat" },
  { code: "Wn-9", short: "Hujan, awan tebal", emoji: "🌧️", group: "langit", tier: "Low", action: "Sesuaikan jadwal melaut",
    description: "Hujan atau langit tertutup awan tebal, saat angin timur" },
  { code: "Wn-6", short: "Camar ribut", emoji: "🕊️", group: "hewan", tier: "Low", action: "Berhati-hati",
    description: "Burung camar terbang tergesa sambil bersuara keras" },
  { code: "Wn-5", short: "Lumba-lumba mendekat", emoji: "🐬", group: "hewan", tier: "Low", action: "Berhati-hati",
    description: "Lumba-lumba mendekati perahu, seolah menggiring perahu" },
  { code: "Wn-10", short: "Cerah tanpa awan", emoji: "☀️", group: "langit", tier: "Unranked",
    description: "Cuaca cerah tanpa awan, saat angin barat" },
  { code: "Wn-11", short: "Suara dentuman", emoji: "💥", group: "angin", tier: "Unranked",
    description: "Suara dentuman terdengar 1 atau 7 kali" },
  { code: "Wn-12", short: "Bintang berkelip", emoji: "✨", group: "malam", tier: "Unranked",
    description: "Banyak bintang di malam hari berkelap kelip, saat angin barat" },
  { code: "Wn-14", short: "Bintang dekat bulan", emoji: "🌙", group: "malam", tier: "Unranked",
    description: "Bintang terlihat mendekati atau sejajar dengan bulan" },
  { code: "Wn-15", short: "Kecoak beterbangan", emoji: "🪳", group: "hewan", tier: "Unranked",
    description: "Kecoak berterbangan di dalam kapal" },
  { code: "Wn-16", short: "Bulan di bintang kala", emoji: "🦂", group: "malam", tier: "Unranked",
    description: "Bulan terlihat di antara penjepit bintang Kalajengking" },
  { code: "Wn-17", short: "Paus muncul", emoji: "🐋", group: "hewan", tier: "Unranked",
    description: "Paus muncul ke permukaan laut dan mengibaskan ekornya" },
]

export const getSign = (code: string): Sign | undefined =>
  SIGNS.find((s) => s.code.toLowerCase() === code.trim().toLowerCase())

export const TIER_LABEL: Record<TrustTier, string> = {
  High: "Sangat dipercaya",
  Low: "Kurang dipercaya",
  Unranked: "Belum cukup data",
}
