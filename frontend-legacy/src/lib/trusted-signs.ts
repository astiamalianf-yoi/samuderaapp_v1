export type TrustedSign = {
  code: string;
  label: string;
  icon: string;
  action: string;
  description: string;
};

export const TRUSTED_SIGNS: TrustedSign[] = [
  {
    code: "WN-1",
    label: "Awan turun",
    icon: "cloud-lightning",
    action: "Tunggu di darat",
    description:
      "Awan turun rendah ke permukaan laut menandakan akan terjadi badai atau angin kencang dalam waktu dekat.",
  },
  {
    code: "WN-2",
    label: "Awan bergumpal",
    icon: "cloud",
    action: "Waspada",
    description:
      "Awan hitam bergumpal tebal di langit menandakan potensi hujan deras dan petir.",
  },
  {
    code: "WN-3",
    label: "Kilat",
    icon: "zap",
    action: "Tunggu di darat",
    description:
      "Kilat atau petir di kejauhan menandakan badai mendekat. Segera berlindung.",
  },
  {
    code: "WN-4",
    label: "Ombak besar",
    icon: "waves",
    action: "Tunggu di darat",
    description:
      "Ombak tinggi dan tidak biasa menandakan perubahan cuaca ekstrem di laut.",
  },
  {
    code: "WN-5",
    label: "Lumba-lumba",
    icon: "fish",
    action: "Aman untuk melaut",
    description:
      "Lumba-lumba terlihat dekat permukaan laut menandakan cuaca baik dan aman untuk melaut.",
  },
  {
    code: "WN-6",
    label: "Burung camar",
    icon: "bird",
    action: "Berlayar dengan hati-hati",
    description:
      "Burung camar terbang rendah menuju darat menandakan angin kencang akan datang.",
  },
  {
    code: "WN-7",
    label: "Peralihan angin",
    icon: "wind",
    action: "Waspada",
    description:
      "Perubahan arah angin secara tiba-tiba menandakan perubahan cuaca. Perhatikan kondisi sekitar.",
  },
  {
    code: "WN-8",
    label: "Langit merah",
    icon: "sunset",
    action: "Waspada",
    description:
      "Langit merah saat matahari terbit atau terbenam menandakan perubahan cuaca dalam 1-2 hari.",
  },
  {
    code: "WN-9",
    label: "Bintang redup",
    icon: "star",
    action: "Waspada",
    description:
      "Bintang yang tidak terlalu terang di malam hari menandakan kelembaban tinggi dan potensi hujan.",
  },
  {
    code: "WN-13",
    label: "Ikan naik",
    icon: "fish",
    action: "Tunggu di darat",
    description:
      "Ikan-ikan naik ke permukaan air secara tidak biasa menandakan perubahan tekanan udara dan potensi badai.",
  },
];
