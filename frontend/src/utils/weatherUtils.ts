export function formatDateToID(dateStr?: string): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function formatTimeWIB(dateStr?: string): string {
  if (!dateStr) return "-"
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return (
    d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  )
}

export function buildRecommendation(event: string, description: string): string {
  const source = `${event} ${description}`.toLowerCase()

  if (source.includes("gelombang")) {
    return "Tunda aktivitas pelayaran skala kecil dan perhatikan instruksi otoritas setempat."
  }
  if (source.includes("angin") || source.includes("puting beliung")) {
    return "Hindari berada di dekat pohon tinggi, baliho, dan bangunan yang tidak kokoh."
  }
  if (source.includes("hujan")) {
    return "Siapkan perlengkapan hujan dan jauhi area rawan banjir atau longsor."
  }

  return "Ikuti informasi resmi BMKG dan sesuaikan aktivitas dengan kondisi cuaca terkini."
}

export function proxifyBmkgUrl(url: string, replacements: readonly { from: string; to: string }[]): string {
  let result = url
  for (const { from, to } of replacements) {
    result = result.replace(from, to)
  }
  return result
}

export function extractLocation(headline: string, title: string): string {
  const rawLocation = headline || title
  return rawLocation.replace(/Peringatan Dini Cuaca\s*/i, "").trim() || "Wilayah terdampak"
}

export function findClosestTimeSlot<T extends { local_datetime: string }>(
  slots: T[],
  targetDate: Date = new Date(),
): T | null {
  if (slots.length === 0) return null

  return slots.reduce((best, current) => {
    if (!best) return current
    const curDiff = Math.abs(
      new Date(current.local_datetime).getTime() - targetDate.getTime(),
    )
    const bestDiff = Math.abs(
      new Date(best.local_datetime).getTime() - targetDate.getTime(),
    )
    return curDiff < bestDiff ? current : best
  })
}

export function filterTodaySlots<T extends { local_datetime: string }>(
  allSlots: T[],
  today: Date = new Date(),
): T[] {
  const todayStr = today.toISOString().slice(0, 10)
  return allSlots.filter(
    (slot) =>
      typeof slot.local_datetime === "string" &&
      slot.local_datetime.startsWith(todayStr),
  )
}

export function translateWindDirection(wd: string): string {
  const map: Record<string, string> = {
    N: "Utara",
    NNE: "Utara Timur Laut",
    NE: "Timur Laut",
    ENE: "Timur Timur Laut",
    E: "Timur",
    ESE: "Timur Tenggara",
    SE: "Tenggara",
    SSE: "Selatan Tenggara",
    S: "Selatan",
    SSW: "Selatan Barat Daya",
    SW: "Barat Daya",
    WSW: "Barat Barat Daya",
    W: "Barat",
    WNW: "Barat Barat Laut",
    NW: "Barat Laut",
    NNW: "Utara Barat Laut",
    C: "Tenang",
    VARIABLE: "Bervariasi",
  }

  return map[wd.toUpperCase()] || wd
}
