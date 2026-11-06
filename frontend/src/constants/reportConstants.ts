export const OBSERVATION_OPTIONS = [
  { value: "wn-1", label: "Awan tampak turun ke bawah membentuk gumpalan 3 kali" },
  { value: "wn-2", label: "Awan bergumpal dalam beberapa kelompok yang tampak saling mendekat atau menyatu" },
  { value: "wn-3", label: "Kilat muncul di salah satu sisi langit ataupun saling berbalas antara dua sisi" },
  { value: "wn-4", label: "Gelombang laut berubah pola dari kecil dan sering hingga besar dan rapat" },
  { value: "wn-5", label: "Lumba-lumba mendekati perahu, seolah menggiring perahu" },
  { value: "wn-6", label: "Burung camar terbang tergesa sambil bersuara keras" },
  { value: "wn-7", label: "Pada masa peralihan angin barat ke angin timur" },
  { value: "wn-8", label: "Langit mendung namun tidak terlalu gelap" },
  { value: "wn-9", label: "Hujan atau langit tertutup awan tebal, saat angin timur" },
  { value: "wn-10", label: "Cuaca cerah tanpa awan, saat angin barat" },
  { value: "wn-11", label: "Suara dentuman terdengar 1 atau 7 kali" },
  { value: "wn-12", label: "Banyak bintang di malam hari berkelap kelip, saat angin barat" },
  { value: "wn-13", label: "Bintang tidak terlihat di malam hari, saat angin timur" },
  { value: "wn-14", label: "Bintang terlihat mendekati atau sejajar dengan bulan" },
  { value: "wn-15", label: "Kecoak berterbangan di dalam kapal" },
  { value: "wn-16", label: "Bulan terlihat di antara penjepit bintang Kalajengking" },
  { value: "wn-17", label: "Paus muncul ke permukaan laut dan mengibaskan ekornya" },
  { value: "wn-18", label: "Penyu naik ke permukaan laut dan mengeluarkan suara" },
  // Ts: Tanda Sinyal / Gempa
  { value: "ts-1", label: "Air laut sangat tenang (tidak ada pasang atau surut)" },
  { value: "ts-2", label: "Terdengar suara gemuruh di langit bersamaan dengan terasa guncangan gempa" },
  { value: "ts-3", label: "Air laut tiba-tiba surut" },
  { value: "ts-4", label: "Ombak tiba-tiba membesar" },
  { value: "ts-6", label: "Hewan peliharaan tampak gelisah" },
  // Cr: Kondisi Kritis / Perubahan Air
  { value: "cr-1", label: "Banyak sampah atau kayu yang hanyut di laut" },
  { value: "cr-2", label: "Air laut tiba-tiba berubah menjadi keruh" },
  { value: "cr-3", label: "Permukaan air terlihat beriak melengkung" },
  { value: "cr-4", label: "Bintang Tujuh (Pleiades) tenggelam atau tidak terlihat" },
  // Td: Tanda Alam Lainnya
  { value: "td-1", label: "Sedang terjadi Bulan Purnama" },
] as const

export const INTERACTION_LEVELS = [
  { value: 1, label: "Sangat Rendah" },
  { value: 2, label: "Rendah" },
  { value: 3, label: "Sedang" },
  { value: 4, label: "Tinggi" },
  { value: 5, label: "Sangat Tinggi" },
] as const

export const API_BASE_URL = 'https://api.samudraapp.com'
