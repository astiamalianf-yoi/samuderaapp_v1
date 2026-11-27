import { describe, it, expect, vi } from 'vitest'
import { reportService, ApiError } from '../reportService'
import type { PredictionInput, AckInput } from '../../types/api'

function mockFetchOk(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

function mockFetchError(status: number, body: unknown = { message: 'Error occurred' }) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response)
}

describe('reportService', () => {
  describe('ApiError', () => {
    it('sets name to "ApiError"', () => {
      const err = new ApiError('oops', 422)
      expect(err.name).toBe('ApiError')
    })

    it('stores statusCode and details', () => {
      const err = new ApiError('msg', 500, { extra: true })
      expect(err.statusCode).toBe(500)
      expect(err.details).toEqual({ extra: true })
    })
  })

  describe('submitReport', () => {
    const input: PredictionInput = {
      lik_codes: ['Wn-1', 'Ts-3'],
      beach_location: 'pantai_depok',
      clientReportId: 'uuid-xyz',
      createdAtClient: 1000,
    }

    it('calls POST /api/report with correct body', async () => {
      mockFetchOk({ success: true })

      await reportService.submitReport(input)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.samudraapp.com/api/report',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      )
    })

    it('returns the response body on success', async () => {
      const response = { success: true, alertId: 'alert-1' }
      mockFetchOk(response)

      const result = await reportService.submitReport(input)

      expect(result).toEqual(response)
    })

    it('throws ApiError when response is not ok', async () => {
      mockFetchError(422, { message: 'Validation failed' })

      await expect(reportService.submitReport(input)).rejects.toThrow('Validation failed')
    })

    it('throws ApiError with correct statusCode', async () => {
      mockFetchError(500)

      try {
        await reportService.submitReport(input)
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError)
        expect((err as ApiError).statusCode).toBe(500)
      }
    })
  })

  describe('getHistory', () => {
    it('calls GET /api/history with default params (limit=20, mine=true)', async () => {
      mockFetchOk({ items: [], count: 0 })

      await reportService.getHistory()

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('limit=20')
      expect(url).toContain('mine=true')
    })

    it('calls GET /api/history with custom params', async () => {
      mockFetchOk({ items: [], count: 0 })

      await reportService.getHistory(10, false)

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('limit=10')
      expect(url).toContain('mine=false')
    })

    it('returns history response on success', async () => {
      const response = {
        items: [{ id: 'h1', userId: 'u1', lik_codes: ['Wn-1'], beach_location: 'pantai_depok', createdAt: 0 }],
        count: 1,
      }
      mockFetchOk(response)

      const result = await reportService.getHistory()

      expect(result.count).toBe(1)
      expect(result.items[0].id).toBe('h1')
    })

    it('throws ApiError when response is not ok', async () => {
      mockFetchError(403)

      await expect(reportService.getHistory()).rejects.toBeInstanceOf(ApiError)
    })
  })

  describe('getActiveReports', () => {
    it('calls GET /api/reports/active with encoded beach_location', async () => {
      mockFetchOk({ ok: true, beach_location: 'pantai_depok', window_ms: 600000, threshold: 3, counts: {} })

      await reportService.getActiveReports('pantai_depok')

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('pantai_depok')
    })

    it('returns ActiveReportResponse on success', async () => {
      const response = {
        ok: true,
        beach_location: 'pantai_depok' as const,
        window_ms: 600000,
        threshold: 3,
        counts: {},
      }
      mockFetchOk(response)

      const result = await reportService.getActiveReports('pantai_depok')

      expect(result.ok).toBe(true)
      expect(result.beach_location).toBe('pantai_depok')
    })
  })

  describe('sendAck', () => {
    const ackData: AckInput = {
      alertId: 'alert-123',
      transport: 'SSE',
      receivedAtClient: Date.now(),
      serverTimestamp: Date.now() - 1000,
      ackStage: 'DELIVERED',
    }

    it('calls POST /api/ack with correct body', async () => {
      mockFetchOk({}, 204)

      await reportService.sendAck(ackData)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.samudraapp.com/api/ack',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(ackData),
        }),
      )
    })

    it('throws ApiError when sendAck fails', async () => {
      mockFetchError(400, { message: 'Bad ACK' })

      await expect(reportService.sendAck(ackData)).rejects.toThrow('Bad ACK')
    })
  })
})
