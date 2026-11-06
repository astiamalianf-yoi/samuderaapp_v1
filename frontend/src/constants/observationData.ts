import type { IObservation, BeachLocation } from '../types/api';

export interface BeachLocationMeta {
  value: BeachLocation;
  label: string;
  adm4Code: string;
  /** Region shown under the beach name. */
  region: string;
  /** Beach front (approx.), used to pick the nearest beach from GPS. */
  lat: number;
  lon: number;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  attributeGroups: Record<string, IObservation[]>;
}

export const BEACH_LOCATIONS: BeachLocationMeta[] = [
  {
    value: 'pantai_lampuuk',
    label: 'Pantai Lampuuk',
    adm4Code: '11.06.02.2023', // Meunasah Mesjid Lampuuk, Lhoknga
    region: 'Aceh',
    lat: 5.4833,
    lon: 95.2333,
  },
  {
    value: 'pantai_lhoknga',
    label: 'Pantai Lhoknga',
    adm4Code: '11.06.02.2001',
    region: 'Aceh',
    lat: 5.4667,
    lon: 95.2333,
  },
  {
    value: 'pantai_ulee_lheue',
    label: 'Pantai Ulee Lheue',
    adm4Code: '11.71.03.2002',
    region: 'Aceh',
    lat: 5.5583,
    lon: 95.3083,
  },
  {
    value: 'pantai_depok',
    label: 'Pantai Depok',
    adm4Code: '34.02.03.2002',
    region: 'Yogyakarta',
    lat: -8.0167,
    lon: 110.3167,
  },
  {
    value: 'pantai_samas',
    label: 'Pantai Samas',
    adm4Code: '34.02.02.2003',
    region: 'Yogyakarta',
    lat: -8.025,
    lon: 110.3,
  },  {
    value: 'pantai_pangandaran',
    label: 'Pantai Pangandaran',
    adm4Code: '32.18.09.2004', // Desa Pangandaran, Kec. Pangandaran
    region: 'Jawa Barat',
    lat: -7.6955,
    lon: 108.653,
  },
  {
    value: 'pantai_batu_karas',
    label: 'Pantai Batu Karas',
    adm4Code: '32.18.02.2001', // Desa Batukaras, Kec. Cijulang
    region: 'Jawa Barat',
    lat: -7.7486,
    lon: 108.4966,
  },
  {
    value: 'pantai_bojongsalawe',
    label: 'Pantai Bojongsalawe',
    adm4Code: '32.18.01.2007', // Desa Karangjaladri, Kec. Parigi
    region: 'Jawa Barat',
    lat: -7.7033,
    lon: 108.5275,
  },
];

export const getBeachMeta = (value: BeachLocation) =>
  BEACH_LOCATIONS.find((beach) => beach.value === value) ?? null;

// 3-Level Nested Structure: Category → AttributeGroup → Observations
export const OBSERVATION_DATA: Record<string, Record<string, IObservation[]>> = {
  "🌊 Kondisi Laut & Gempa": {
    "Air Laut & Ombak 🌊": [
      { label: "Air laut sangat tenang", attribute: "Sea", object: "Tidal Movement", value: "Calm (no high or low tide)" },
      { label: "Air laut tiba-tiba surut", attribute: "Sea", object: "Water Level", value: "Sudden Recession" },
      { label: "Ombak tiba-tiba membesar", attribute: "Sea", object: "Wave Condition", value: "Very Large" },
      { label: "Ombak membesar & rapat", attribute: "Sea", object: "Wave Pattern", value: "Small and Frequent (to) Large and Close" },
      { label: "Banyak sampah/kayu hanyut", attribute: "Sea", object: "Surface Debris", value: "A Lot of Trash or Wood" },
      { label: "Air laut berubah keruh", attribute: "Sea", object: "Water Clarity", value: "Murky/Turbid" },
      { label: "Permukaan air beriak melengkung", attribute: "Sea", object: "Surface Pattern", value: "Rippling/Arc Formation" }
    ],
    "Getaran Bumi 🌍": [
      { label: "Terasa guncangan gempa", attribute: "Seismic", object: "Ground Sensation", value: "Felt Earthquake" }
    ]
  },
  "☁️ Cuaca, Angin & Awan": {
    "Awan ☁️": [
      { label: "Awan turun merendah", attribute: "Cloud", object: "Cloud Pattern", value: "Descending Clusters" },
      { label: "Awan terlihat menyatu", attribute: "Cloud", object: "Cloud Pattern", value: "Merging Clusters" },
      { label: "Mendung tebal/pekat", attribute: "Cloud", object: "Cloud Density", value: "Thick Clouds" }
    ],
    "Arah Angin & Cuaca ⛅": [
      { label: "Musim Angin Timur", attribute: "Atmosphere", object: "Wind/Monsoon Season", value: "East Wind (Monsoon)" },
      { label: "Musim Angin Barat", attribute: "Atmosphere", object: "Wind/Monsoon Season", value: "West Wind (Monsoon)" },
      { label: "Transisi Barat ke Timur", attribute: "Atmosphere", object: "Wind/Monsoon Season", value: "West-to-East Transition" },
      { label: "Langit cerah tanpa awan", attribute: "Atmosphere", object: "Weather Condition", value: "Clear/No Clouds" },
      { label: "Turun hujan", attribute: "Atmosphere", object: "Precipitation", value: "Rain" },
      { label: "Suara gemuruh di langit", attribute: "Atmosphere", object: "Ambient Sound", value: "Rumbling" },
      { label: "Suara dentuman keras", attribute: "Atmosphere", object: "Ambient Sound", value: "Thunderous Booms/Rumbling" },
      { label: "Suasana sunyi senyap", attribute: "Atmosphere", object: "Ambient Sound", value: "Extreme Silence" }
    ],
    "Petir ⚡": [
      { label: "Petir menyambar satu sisi", attribute: "Lightning", object: "Lightning Activity", value: "Single-Sided" }
    ]
  },
  "🌌 Bintang & Bulan": {
    "Bintang 🌟": [
      { label: "Bintang berkedip-kedip", attribute: "Star", object: "Star Condition", value: "Many/Twinkling" },
      { label: "Bintang tidak terlihat", attribute: "Star", object: "Star Condition", value: "Not Visible" },
      { label: "Bintang mendekati bulan", attribute: "Star", object: "Star Position", value: "Approaching/Aligning with Moon" },
      { label: "Bintang masuk cahaya bulan", attribute: "Star", object: "Star Position", value: "Entering Moon's Halo" },
      { label: "Bintang Tujuh terlihat jelas", attribute: "Star", object: "Star Cluster", value: "Pleiades (Seven Stars) Observed" },
      { label: "Bintang Tujuh tenggelam", attribute: "Star", object: "Pleiades (Seven Stars)", value: "Immersed/Not Visible" }
    ],
    "Bulan 🌕": [
      { label: "Sedang Bulan Purnama", attribute: "Moon", object: "Moon Phase", value: "Full Moon" }
    ]
  },
  "🐋 Tanda dari Hewan": {
    "Burung Camar 🦅": [
      { label: "Terbang tergesa-gesa", attribute: "Seagull", object: "Seagull Movement", value: "Hasty Flying" },
      { label: "Bersuara nyaring", attribute: "Seagull", object: "Seagull Sound", value: "Loud Calling" }
    ],
    "Lumba-lumba 🐬": [
      { label: "Mengawal perahu", attribute: "Dolphin", object: "Dolphin Activity", value: "Approaching/Guiding Boat" }
    ],
    "Paus 🐋": [
      { label: "Mengibaskan ekor", attribute: "Whale", object: "Whale Activity", value: "Surfaces and Tail Flicking" }
    ],
    "Serangga 🐜": [
      { label: "Banyak kecoa terbang di perahu", attribute: "Animal Behavior", object: "Cockroach Activity", value: "Flying Inside Boat" }
    ],
    "Hewan Peliharaan 🐕": [
      { label: "Hewan peliharaan gelisah", attribute: "Pets", object: "Pets", value: "Distressed" }
    ]
  }
};

// Helper to get category list with icons
export const CATEGORY_LIST = [
  { id: "🌊 Kondisi Laut & Gempa", label: "Kondisi Laut & Gempa", icon: "🌊" },
  { id: "☁️ Cuaca, Angin & Awan", label: "Cuaca, Angin & Awan", icon: "☁️" },
  { id: "🌌 Bintang & Bulan", label: "Bintang & Bulan", icon: "🌌" },
  { id: "🐋 Tanda dari Hewan", label: "Tanda dari Hewan", icon: "🐋" }
];
