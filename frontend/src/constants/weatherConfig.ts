export const WEATHER_CONFIG = {
  BMKG_RSS_PROXY: "/bmkg/alerts/nowcast/id",
  BMKG_API_PROXY: "https://api.bmkg.go.id/publik/prakiraan-cuaca",
  BMKG_BASE_URL: "https://www.bmkg.go.id",
  MAX_ALERTS_TO_FETCH: 3,
  SKELETON_COUNT: 2,
  DEFAULT_ADM4_CODE: "31.71.01.1001", // Ganti sesuai wilayah
} as const

export const PROXY_REPLACEMENTS = [
  { from: "https://www.bmkg.go.id", to: "/bmkg" },
  { from: "http://www.bmkg.go.id", to: "/bmkg" },
] as const
