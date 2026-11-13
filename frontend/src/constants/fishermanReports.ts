import type { BeachLocation } from "../types/api"



export interface FishermanReport {
  id: string
  beachValue?: BeachLocation
  lokasi: string
  waktu: string
  gelombang?: string
  isActionable: boolean
  likCodes: string[]
  signDescription?: string
  actionRecommendation?: string
}

export const FISHERMAN_REPORTS: FishermanReport[] = [
  {
    id: "1",
    lokasi: "Pantai Depok",
    waktu: "Hari ini, 07:15",
    gelombang: "1.2 - 1.8 m",
    isActionable: false,
    likCodes: ["wn-2", "wn-4", "wn-6"],
    actionRecommendation: "Kondisi aman, tetap perhatikan perubahan cuaca.",
    signDescription: "Tanda alam terdeteksi namun masih dalam batas normal.",
  },
  {
    id: "2",
    lokasi: "Pantai Samas",
    waktu: "Hari ini, 09:40",
    gelombang: "2.0 - 2.6 m",
    isActionable: true,
    likCodes: ["wn-3", "wn-9", "wn-15"],
    actionRecommendation: "Segera berlindung di tempat aman dan hindari area pantai.",
    signDescription: "Terdeteksi tanda bahaya cuaca ekstrem. Tindakan segera diperlukan.",
  },
]