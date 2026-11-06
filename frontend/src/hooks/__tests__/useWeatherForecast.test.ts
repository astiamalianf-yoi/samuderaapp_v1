import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWeatherForecast, useAllWeatherForecasts } from '../useWeatherForecast'

// Mock WEATHER_CONFIG constant
vi.mock('../../constants/weatherConfig', () => ({
  WEATHER_CONFIG: {
    BMKG_API_PROXY: '/bmkg-api/publik/prakiraan/cuaca',
    BMKG_RSS_PROXY: '/bmkg/cuaca/peringatan-dini-cuaca.xml',
    DEFAULT_ADM4_CODE: '34.02.01.2001',
    MAX_ALERTS_TO_FETCH: 5,
  },
}))

// Mock weatherUtils
vi.mock('../../utils/weatherUtils', () => ({
  filterTodaySlots: vi.fn((slots: unknown[]) => slots),
  findClosestTimeSlot: vi.fn((slots: unknown[]) => slots[0] ?? null),
  translateWindDirection: vi.fn((wd: string) => wd),
  formatDateToID: vi.fn((d: string) => d),
  formatTimeWIB: vi.fn((d: string) => d),
  buildRecommendation: vi.fn(() => 'Ikuti info BMKG'),
  proxifyBmkgUrl: vi.fn((url: string) => url),
  extractLocation: vi.fn((h: string) => h),
}))

const makeForecastItem = (overrides = {}) => ({
  local_datetime: '2024-06-15T10:00:00',
  t: 30,
  hu: 80,
  weather_desc: 'Cerah',
  ws: 10,
  wd: 'N',
  vs_text: '>10 km',
  ...overrides,
})

function mockFetchOk(body: unknown) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchError(status = 500) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ message: 'error' }),
  } as unknown as Response)
}

describe('useWeatherForecast', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('starts with loading=true and data=null', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useWeatherForecast())
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
  })

  it('returns parsed forecast data on success', async () => {
    const slot = makeForecastItem()
    mockFetchOk({ data: [{ cuaca: [[slot]] }] })

    const { result } = renderHook(() => useWeatherForecast())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.condition).toBe('Cerah')
    expect(result.current.data?.temperature).toBe('30°C')
    expect(result.current.data?.humidity).toBe('80%')
    expect(result.current.data?.windSpeed).toBe('10 km/jam')
    expect(result.current.error).toBeNull()
  })

  it('uses fallback when ws/t/hu are non-numeric strings', async () => {
    const slot = makeForecastItem({ t: 'N/A', ws: 'N/A', hu: 'N/A' })
    mockFetchOk({ data: [{ cuaca: [[slot]] }] })

    const { result } = renderHook(() => useWeatherForecast())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.temperature).toBe('N/A°C')
    expect(result.current.data?.windSpeed).toBe('N/A km/jam')
  })

  it('sets error when fetch response is not ok', async () => {
    mockFetchError(500)

    const { result } = renderHook(() => useWeatherForecast())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Gagal memuat prakiraan cuaca hari ini.')
    expect(result.current.data).toBeNull()
  })

  it('sets error when cuaca structure is invalid', async () => {
    mockFetchOk({ data: [{ cuaca: null }] })

    const { result } = renderHook(() => useWeatherForecast())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Gagal memuat prakiraan cuaca hari ini.')
  })

  it('uses custom adm4Code when provided', async () => {
    mockFetchOk({ data: [{ cuaca: [[makeForecastItem()]] }] })

    renderHook(() => useWeatherForecast('34.99.99.9999'))

    await waitFor(() => {
      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('34.99.99.9999')
    })
  })
})

describe('useAllWeatherForecasts', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('starts with loading=true and data=[]', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAllWeatherForecasts())
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toEqual([])
  })

  it('returns flat array of all forecast slots on success', async () => {
    const slots = [makeForecastItem(), makeForecastItem({ local_datetime: '2024-06-16T10:00:00' })]
    mockFetchOk({ data: [{ cuaca: [slots] }] })

    const { result } = renderHook(() => useAllWeatherForecasts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.error).toBeNull()
  })

  it('sets error when fetch fails', async () => {
    mockFetchError()

    const { result } = renderHook(() => useAllWeatherForecasts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Gagal memuat prakiraan cuaca.')
  })

  it('sets error when cuaca structure is invalid', async () => {
    mockFetchOk({ data: [{ cuaca: 'bad' }] })

    const { result } = renderHook(() => useAllWeatherForecasts())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Gagal memuat prakiraan cuaca.')
  })
})
