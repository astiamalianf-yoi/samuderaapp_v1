import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReportForm } from '../useReportForm'

// Mock authService.getToken
vi.mock('../../services/authService', () => ({
  authService: {
    getToken: vi.fn().mockReturnValue('fake-token'),
  },
}))

// Mock the API_BASE_URL constant
vi.mock('../../constants/reportConstants', () => ({
  API_BASE_URL: 'https://api.samudraapp.com',
  OBSERVATION_OPTIONS: [],
  INTERACTION_LEVELS: [],
}))

function mockFetchOk(body: unknown = {}) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchError() {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ message: 'Server error' }),
  } as unknown as Response)
}

describe('useReportForm', () => {
  describe('initial state', () => {
    it('starts with all numeric fields set to 0', () => {
      const { result } = renderHook(() => useReportForm())

      expect(result.current.formData).toEqual({
        levelOfInteraction: 0,
        age: 0,
        usageDuration: 0,
        minFrequency: 0,
        fishingExperience: 0,
      })
    })

    it('starts with empty selectedObservations', () => {
      const { result } = renderHook(() => useReportForm())

      expect(result.current.selectedObservations).toEqual([])
    })

    it('starts with isSubmitting = false', () => {
      const { result } = renderHook(() => useReportForm())

      expect(result.current.isSubmitting).toBe(false)
    })
  })

  describe('updateField', () => {
    it('updates a single field correctly', () => {
      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.updateField('age', 30)
      })

      expect(result.current.formData.age).toBe(30)
    })

    it('does not affect other fields when one is updated', () => {
      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.updateField('fishingExperience', 10)
      })

      expect(result.current.formData.levelOfInteraction).toBe(0)
      expect(result.current.formData.age).toBe(0)
      expect(result.current.formData.usageDuration).toBe(0)
      expect(result.current.formData.minFrequency).toBe(0)
      expect(result.current.formData.fishingExperience).toBe(10)
    })
  })

  describe('setSelectedObservations', () => {
    it('updates selectedObservations', () => {
      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1', 'ts-3'])
      })

      expect(result.current.selectedObservations).toEqual(['wn-1', 'ts-3'])
    })

    it('can set empty array to clear observations', () => {
      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1'])
      })
      act(() => {
        result.current.setSelectedObservations([])
      })

      expect(result.current.selectedObservations).toEqual([])
    })
  })

  describe('resetForm', () => {
    it('resets all fields to initial state', () => {
      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.updateField('age', 25)
        result.current.updateField('fishingExperience', 5)
        result.current.setSelectedObservations(['wn-1', 'wn-2'])
      })
      act(() => {
        result.current.resetForm()
      })

      expect(result.current.formData).toEqual({
        levelOfInteraction: 0,
        age: 0,
        usageDuration: 0,
        minFrequency: 0,
        fishingExperience: 0,
      })
      expect(result.current.selectedObservations).toEqual([])
    })
  })

  describe('submitReport', () => {
    it('calls alert and throws when no observations are selected', async () => {
      const { result } = renderHook(() => useReportForm())

      await expect(
        act(() => result.current.submitReport()),
      ).rejects.toThrow('No observations selected')

      expect(globalThis.alert).toHaveBeenCalledWith('Silakan pilih minimal satu objek pengamatan')
    })

    it('sets isSubmitting to true during submission and false after', async () => {
      mockFetchOk({ success: true })

      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1'])
      })

      await act(async () => {
        await result.current.submitReport()
      })

      expect(result.current.isSubmitting).toBe(false)
    })

    it('calls fetch with the correct payload on success', async () => {
      mockFetchOk({ success: true })

      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1', 'ts-3'])
        result.current.updateField('age', 35)
      })

      await act(async () => {
        await result.current.submitReport()
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.samudraapp.com/api/report',
        expect.objectContaining({ method: 'POST' }),
      )

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
      expect(body.lik_codes).toEqual(['wn-1', 'ts-3'])
      expect(body.age).toBe(35)
    })

    it('resets form and shows success alert after successful submission', async () => {
      mockFetchOk({ success: true })

      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1'])
        result.current.updateField('age', 28)
      })

      await act(async () => {
        await result.current.submitReport()
      })

      expect(globalThis.alert).toHaveBeenCalledWith('Laporan berhasil dikirim!')
      expect(result.current.formData.age).toBe(0)
      expect(result.current.selectedObservations).toEqual([])
    })

    it('shows error alert and throws on fetch failure', async () => {
      mockFetchError()

      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1'])
      })

      await expect(
        act(() => result.current.submitReport()),
      ).rejects.toThrow()

      expect(globalThis.alert).toHaveBeenCalledWith('Gagal mengirim laporan. Silakan coba lagi.')
    })

    it('sets isSubmitting to false even after an error', async () => {
      mockFetchError()

      const { result } = renderHook(() => useReportForm())

      act(() => {
        result.current.setSelectedObservations(['wn-1'])
      })

      await act(async () => {
        try {
          await result.current.submitReport()
        } catch {
          // expected
        }
      })

      expect(result.current.isSubmitting).toBe(false)
    })
  })
})
