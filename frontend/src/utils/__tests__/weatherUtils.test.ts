import { describe, it, expect } from 'vitest'
import {
  formatDateToID,
  formatTimeWIB,
  buildRecommendation,
  proxifyBmkgUrl,
  extractLocation,
  findClosestTimeSlot,
  filterTodaySlots,
  translateWindDirection,
} from '../weatherUtils'

describe('formatDateToID', () => {
  it('returns "-" for undefined input', () => {
    expect(formatDateToID(undefined)).toBe('-')
  })

  it('returns "-" for empty string', () => {
    expect(formatDateToID('')).toBe('-')
  })

  it('returns original string for invalid date', () => {
    expect(formatDateToID('bukan-tanggal')).toBe('bukan-tanggal')
  })

  it('formats a valid ISO date to Indonesian locale', () => {
    // Use a fixed UTC date; result may vary by locale but must include year 2024
    const result = formatDateToID('2024-06-15T00:00:00Z')
    expect(result).toContain('2024')
  })
})

describe('formatTimeWIB', () => {
  it('returns "-" for undefined input', () => {
    expect(formatTimeWIB(undefined)).toBe('-')
  })

  it('returns "-" for empty string', () => {
    expect(formatTimeWIB('')).toBe('-')
  })

  it('returns original string for invalid date', () => {
    expect(formatTimeWIB('invalid')).toBe('invalid')
  })

  it('appends WIB suffix to a valid time', () => {
    const result = formatTimeWIB('2024-06-15T10:30:00+07:00')
    expect(result).toMatch(/WIB$/)
  })
})

describe('buildRecommendation', () => {
  it('returns wave recommendation when event contains "gelombang"', () => {
    const result = buildRecommendation('Gelombang Tinggi', '')
    expect(result).toContain('pelayaran')
  })

  it('returns wind recommendation when event contains "angin"', () => {
    const result = buildRecommendation('Angin Kencang', '')
    expect(result).toContain('pohon tinggi')
  })

  it('returns wind recommendation when event contains "puting beliung"', () => {
    const result = buildRecommendation('Puting Beliung', '')
    expect(result).toContain('pohon tinggi')
  })

  it('returns rain recommendation when description contains "hujan"', () => {
    const result = buildRecommendation('', 'hujan lebat diperkirakan')
    expect(result).toContain('hujan')
  })

  it('returns default recommendation for unknown event', () => {
    const result = buildRecommendation('Cuaca Ekstrem', 'tidak ada keterangan')
    expect(result).toContain('BMKG')
  })

  it('prioritizes gelombang over angin when both present', () => {
    const result = buildRecommendation('Gelombang dan Angin', '')
    expect(result).toContain('pelayaran')
  })
})

describe('proxifyBmkgUrl', () => {
  const replacements = [
    { from: 'https://www.bmkg.go.id', to: '/bmkg' },
    { from: 'https://api.bmkg.go.id', to: '/bmkg-api' },
  ]

  it('replaces first matching domain', () => {
    const result = proxifyBmkgUrl('https://www.bmkg.go.id/path/to/resource', replacements)
    expect(result).toBe('/bmkg/path/to/resource')
  })

  it('replaces second matching domain', () => {
    const result = proxifyBmkgUrl('https://api.bmkg.go.id/data', replacements)
    expect(result).toBe('/bmkg-api/data')
  })

  it('returns url unchanged if no replacement matches', () => {
    const result = proxifyBmkgUrl('https://example.com/data', replacements)
    expect(result).toBe('https://example.com/data')
  })

  it('handles empty replacements array', () => {
    const result = proxifyBmkgUrl('https://example.com', [])
    expect(result).toBe('https://example.com')
  })
})

describe('extractLocation', () => {
  it('removes "Peringatan Dini Cuaca" prefix from headline', () => {
    const result = extractLocation('Peringatan Dini Cuaca Bantul', '')
    expect(result).toBe('Bantul')
  })

  it('is case-insensitive for prefix removal', () => {
    const result = extractLocation('PERINGATAN DINI CUACA Bantul', '')
    expect(result).toBe('Bantul')
  })

  it('uses title as fallback when headline is empty', () => {
    const result = extractLocation('', 'Yogyakarta')
    expect(result).toBe('Yogyakarta')
  })

  it('returns fallback text when both are empty', () => {
    const result = extractLocation('', '')
    expect(result).toBe('Wilayah terdampak')
  })

  it('prefers headline over title when both are given', () => {
    const result = extractLocation('Dari Headline', 'Dari Title')
    expect(result).toBe('Dari Headline')
  })
})

describe('findClosestTimeSlot', () => {
  type Slot = { local_datetime: string }

  it('returns null for empty array', () => {
    expect(findClosestTimeSlot([])).toBeNull()
  })

  it('returns the only element for single-slot array', () => {
    const slots: Slot[] = [{ local_datetime: '2024-06-15T10:00:00' }]
    expect(findClosestTimeSlot(slots, new Date('2024-06-15T09:00:00'))).toEqual(slots[0])
  })

  it('returns the closest slot to the target date', () => {
    const slots: Slot[] = [
      { local_datetime: '2024-06-15T06:00:00' },
      { local_datetime: '2024-06-15T12:00:00' },
      { local_datetime: '2024-06-15T18:00:00' },
    ]
    const target = new Date('2024-06-15T13:00:00')
    expect(findClosestTimeSlot(slots, target)).toEqual(slots[1])
  })
})

describe('filterTodaySlots', () => {
  type Slot = { local_datetime: string }

  it('returns empty array when no slots match today', () => {
    const today = new Date('2024-06-15')
    const slots: Slot[] = [
      { local_datetime: '2024-06-14T10:00:00' },
      { local_datetime: '2024-06-16T10:00:00' },
    ]
    expect(filterTodaySlots(slots, today)).toHaveLength(0)
  })

  it('returns only slots matching today', () => {
    const today = new Date('2024-06-15')
    const slots: Slot[] = [
      { local_datetime: '2024-06-14T10:00:00' },
      { local_datetime: '2024-06-15T06:00:00' },
      { local_datetime: '2024-06-15T12:00:00' },
      { local_datetime: '2024-06-16T10:00:00' },
    ]
    const result = filterTodaySlots(slots, today)
    expect(result).toHaveLength(2)
    expect(result[0].local_datetime).toContain('2024-06-15')
  })
})

describe('translateWindDirection', () => {
  it('translates "N" to "Utara"', () => {
    expect(translateWindDirection('N')).toBe('Utara')
  })

  it('translates "S" to "Selatan"', () => {
    expect(translateWindDirection('S')).toBe('Selatan')
  })

  it('translates "NE" to "Timur Laut"', () => {
    expect(translateWindDirection('NE')).toBe('Timur Laut')
  })

  it('translates "SW" to "Barat Daya"', () => {
    expect(translateWindDirection('SW')).toBe('Barat Daya')
  })

  it('translates "C" to "Tenang"', () => {
    expect(translateWindDirection('C')).toBe('Tenang')
  })

  it('translates "VARIABLE" to "Bervariasi"', () => {
    expect(translateWindDirection('VARIABLE')).toBe('Bervariasi')
  })

  it('is case-insensitive', () => {
    expect(translateWindDirection('nw')).toBe('Barat Laut')
  })

  it('returns original string for unknown direction', () => {
    expect(translateWindDirection('XYZ')).toBe('XYZ')
  })
})
