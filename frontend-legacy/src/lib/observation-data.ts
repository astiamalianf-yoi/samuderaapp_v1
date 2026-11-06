import type { IObservation } from "@/lib/types";

export const OBSERVATION_DATA: Record<string, Record<string, IObservation[]>> = {
  laut: {
    Sea: [
      {
        label: "Ombak tiba-tiba membesar",
        attribute: "Sea",
        object: "Wave Pattern",
        value: "Small and Frequent to Large and Close",
      },
    ],
    Dolphin: [
      {
        label: "Lumba-lumba mengawal perahu",
        attribute: "Dolphin",
        object: "Dolphin Activity",
        value: "Approaching/Guiding Boat",
      },
    ],
  },
  cuaca: {
    Cloud: [
      {
        label: "Awan turun merendah",
        attribute: "Cloud",
        object: "Cloud Pattern",
        value: "Descending Clusters",
      },
      {
        label: "Awan hitam bergumpal tebal",
        attribute: "Cloud",
        object: "Cloud Pattern",
        value: "Merging Clusters",
      },
    ],
    Lightning: [
      {
        label: "Petir menyambar berulang",
        attribute: "Lightning",
        object: "Lightning Activity",
        value: "Single-Sided",
      },
    ],
    Wind: [
      {
        label: "Angin berpindah arah",
        attribute: "Wind",
        object: "Wind/Monsoon Season",
        value: "West-to-East Transition",
      },
    ],
    Sky: [
      {
        label: "Langit merah saat senja",
        attribute: "Sky",
        object: "Weather Condition",
        value: "Red Sky/Sunset",
      },
    ],
  },
  langit: {
    Star: [
      {
        label: "Bintang redup/tidak terlihat",
        attribute: "Star",
        object: "Star Condition",
        value: "Dim/Not Visible",
      },
    ],
  },
  hewan: {
    Seagull: [
      {
        label: "Burung camar terbang tergesa",
        attribute: "Seagull",
        object: "Seagull Movement",
        value: "Hasty Flying",
      },
      {
        label: "Suara burung camar keras",
        attribute: "Seagull",
        object: "Seagull Sound",
        value: "Loud Calling",
      },
    ],
    Fish: [
      {
        label: "Ikan naik ke permukaan",
        attribute: "Fish",
        object: "Fish Activity",
        value: "Surfacing Unusually",
      },
    ],
  },
};

export const CATEGORY_LIST: Array<{ id: string; label: string; icon: string }> =
  [
    { id: "laut", label: "Kondisi Laut", icon: "🌊" },
    { id: "cuaca", label: "Cuaca & Angin", icon: "☁️" },
    { id: "langit", label: "Bintang & Langit", icon: "🌌" },
    { id: "hewan", label: "Tanda Hewan", icon: "🐋" },
  ];

export const ATTRIBUTE_LABELS: Record<string, string> = {
  Sea: "Laut & Ombak",
  Cloud: "Awan",
  Lightning: "Petir",
  Wind: "Angin",
  Sky: "Langit",
  Star: "Bintang",
  Seagull: "Burung Camar",
  Fish: "Ikan",
  Dolphin: "Lumba-lumba",
};
