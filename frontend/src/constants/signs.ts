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

/** How far science explains a sign: supported, partly explained, or no scientific explanation yet. */
export type Evidence = "didukung" | "sebagian" | "belum"

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  didukung: "Didukung sains",
  sebagian: "Sebagian dijelaskan",
  belum: "Belum ada penjelasan ilmiah",
}

/**
 * Plain-language scientific explanation per sign (Tanda Alam page), with an honest evidence level.
 * Sources: BMKG (awan cumulonimbus, pancaroba), NOAA/SciJinks (gust front), swell dispersion
 * (Bosboom & Stive), Gillies et al. 2023 PNAS (seabirds and storm infrasound),
 * Hamacher et al. 2019 Proc. R. Soc. Victoria (star twinkling and wind).
 */
export const SIGN_SCIENCE: Record<string, { evidence: Evidence; text: string; source?: string }> = {
  "Wn-3": { evidence: "didukung", source: "BMKG; NOAA",
    text: "Kilat berasal dari awan cumulonimbus (awan badai). Kilat di salah satu sisi langit berarti ada badai di sisi itu. Udara dingin yang jatuh dari awan badai menyebar keluar sebagai angin kencang mendadak (gust front), dan udara mengalir dari tekanan tinggi ke tekanan rendah, sehingga angin bisa bergerak ke arah perahu. Kilat yang berbalas antara dua sisi berarti ada lebih dari satu awan badai." },
  "Wn-1": { evidence: "didukung", source: "BMKG; NOAA",
    text: "Awan yang turun dan menggumpal adalah tanda awan cumulonimbus yang sudah matang. Saat hujan mulai, udara dingin di dalam awan jatuh ke bawah dan menyebar di permukaan laut sebagai angin kencang mendadak." },
  "Wn-2": { evidence: "didukung", source: "BMKG",
    text: "Gumpalan awan seperti bunga kol yang tumbuh dan menyatu bisa berkembang menjadi awan cumulonimbus. Menurut BMKG, awan ini terkait dengan kilat, angin kencang, puting beliung dan hujan es, dan dikenal membuat cuaca cepat berubah." },
  "Wn-8": { evidence: "sebagian",
    text: "Mendung berarti udara makin lembap dan awan bertambah. Mendung saja tidak selalu membawa angin kencang, tetapi bisa menjadi awal tumbuhnya awan hujan dan awan badai." },
  "Wn-7": { evidence: "didukung", source: "BMKG",
    text: "Masa peralihan angin barat ke angin timur adalah musim pancaroba. BMKG mencatat masa ini sering membawa hujan lebat singkat disertai kilat, angin kencang dan puting beliung, karena banyak awan cumulonimbus tumbuh." },
  "Wn-13": { evidence: "sebagian",
    text: "Bintang hilang berarti langit tertutup awan, sering awan tinggi yang datang sebelum perubahan cuaca. Ini tanda awan bertambah, tetapi tidak selalu diikuti angin kencang." },
  "Wn-4": { evidence: "didukung", source: "Bosboom & Stive; BOM",
    text: "Ombak yang berubah menjadi besar dan rapat berarti angin di sekitar mulai kuat dan menaikkan gelombang. Ombak dari badai di tempat jauh juga bisa sampai lebih dulu daripada badainya, karena gelombang panjang bergerak lebih cepat." },
  "Wn-9": { evidence: "didukung", source: "NOAA",
    text: "Hujan dari awan tebal (cumulonimbus) membawa udara dingin turun ke bawah. Udara ini menyebar sebagai angin kencang mendadak di depan dan di sekitar hujan." },
  "Wn-6": { evidence: "sebagian", source: "Gillies dkk. 2023",
    text: "Beberapa burung laut terbukti bisa mendengar suara sangat rendah (infrasound) dari badai dan ombak, dan peka terhadap perubahan tekanan udara. Apakah camar benar-benar merasakan badai yang datang masih diteliti." },
  "Wn-5": { evidence: "belum",
    text: "Belum ada penjelasan ilmiah bahwa lumba-lumba mendekati perahu sebelum angin kencang. Tanda ini berasal dari pengalaman nelayan." },
  "Wn-10": { evidence: "sebagian",
    text: "Langit cerah bisa terjadi saat angin musim kuat tetapi udaranya kering. Tanda ini lebih terkait dengan musim angin barat daripada tanda badai; belum ada penelitian langsung." },
  "Wn-11": { evidence: "sebagian",
    text: "Dentuman bisa berasal dari guntur badai yang jauh, yang terdengar sebelum badainya sampai. Jumlah dentuman (1 atau 7 kali) belum ada penjelasan ilmiah." },
  "Wn-12": { evidence: "sebagian", source: "Hamacher dkk. 2019",
    text: "Bintang berkelip karena cahayanya melewati udara yang bergolak. Kelip yang kuat bisa menandakan angin kencang di udara atas, dan beberapa masyarakat adat memakainya untuk meramal angin. Hubungannya dengan angin di permukaan laut belum pasti." },
  "Wn-14": { evidence: "belum",
    text: "Belum ada penjelasan ilmiah. Posisi bintang dan bulan berulang setiap tahun, jadi tanda ini bisa dipakai sebagai penanda musim (kalender), bukan penyebab angin." },
  "Wn-15": { evidence: "belum",
    text: "Belum ada penjelasan ilmiah. Serangga kadang lebih aktif saat udara panas dan lembap sebelum hujan, tetapi hubungannya dengan angin kencang belum diteliti." },
  "Wn-16": { evidence: "belum",
    text: "Belum ada penjelasan ilmiah. Rasi Kalajengking terlihat pada bulan-bulan tertentu setiap tahun, jadi tanda ini bisa menjadi penanda musim (kalender), bukan penyebab angin." },
  "Wn-17": { evidence: "belum",
    text: "Belum ada penjelasan ilmiah bahwa paus muncul sebelum angin kencang. Tanda ini berasal dari pengalaman nelayan." },
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

/**
 * Sign inside a warning message: the codebook description, the wording fishermen use and understand
 * (matrix, 23 Nov), not the two-word short name. Several signs are joined with "; ".
 */
export const warningSignText = (code: string): string => {
  const s = getSign(code)
  return s?.description ?? s?.short ?? code
}
