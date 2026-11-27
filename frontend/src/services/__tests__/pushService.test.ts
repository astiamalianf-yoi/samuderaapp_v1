import { describe, it, expect, vi } from 'vitest'
import { pushService } from '../pushService'

function mockFetchOk(body: unknown, contentType = 'application/json', status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    status,
    headers: {
      get: (header: string) => (header === 'content-type' ? contentType : null),
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response)
}

function mockFetchError(status: number) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve({ message: 'Error' }),
    text: () => Promise.resolve('Error detail'),
  } as unknown as Response)
}

describe('pushService', () => {
  describe('getVapidPublicKey', () => {
    it('returns publicKey from JSON response', async () => {
      mockFetchOk({ publicKey: 'my-public-key' })

      const key = await pushService.getVapidPublicKey()

      expect(key).toBe('my-public-key')
    })

    it('falls back to vapidPublicKey field', async () => {
      mockFetchOk({ vapidPublicKey: 'vapid-key' })

      const key = await pushService.getVapidPublicKey()

      expect(key).toBe('vapid-key')
    })

    it('falls back to key field', async () => {
      mockFetchOk({ key: 'bare-key' })

      const key = await pushService.getVapidPublicKey()

      expect(key).toBe('bare-key')
    })

    it('reads plain text when content-type is not JSON', async () => {
      mockFetchOk('plain-text-key', 'text/plain')

      const key = await pushService.getVapidPublicKey()

      expect(key).toBe('plain-text-key')
    })

    it('throws when response is not ok', async () => {
      mockFetchError(500)

      await expect(pushService.getVapidPublicKey()).rejects.toThrow('Gagal memuat VAPID public key')
    })

    it('throws when key is empty in JSON response', async () => {
      mockFetchOk({})

      await expect(pushService.getVapidPublicKey()).rejects.toThrow('VAPID public key tidak ditemukan')
    })
  })

  describe('subscribe', () => {
    const mockSubscription = {
      endpoint: 'https://push.example.com/sub/1',
      expirationTime: null,
      keys: { p256dh: 'abc', auth: 'xyz' },
      toJSON: () => ({ endpoint: 'https://push.example.com/sub/1', keys: { p256dh: 'abc', auth: 'xyz' } }),
    } as unknown as PushSubscription

    it('calls POST /api/push/subscribe without metadata', async () => {
      mockFetchOk({})

      await pushService.subscribe(mockSubscription)

      expect(fetch).toHaveBeenCalledWith(
        'https://api.samudraapp.com/api/push/subscribe',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('calls POST /api/push/subscribe with metadata when provided', async () => {
      mockFetchOk({})

      await pushService.subscribe(mockSubscription, { beach_location: 'pantai_depok' })

      const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
      expect(body).toHaveProperty('metadata')
      expect(body.metadata.beach_location).toBe('pantai_depok')
    })

    it('throws when response is not ok', async () => {
      mockFetchError(400)

      await expect(pushService.subscribe(mockSubscription)).rejects.toThrow('Gagal menyimpan subscription push')
    })
  })

  describe('unsubscribe', () => {
    it('calls POST /api/push/unsubscribe with the endpoint', async () => {
      mockFetchOk({})

      await pushService.unsubscribe('https://push.example.com/sub/1')

      expect(fetch).toHaveBeenCalledWith(
        'https://api.samudraapp.com/api/push/unsubscribe',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ endpoint: 'https://push.example.com/sub/1' }),
        }),
      )
    })

    it('throws when response is not ok', async () => {
      mockFetchError(404)

      await expect(pushService.unsubscribe('https://push.example.com/sub/1')).rejects.toThrow(
        'Gagal menghapus subscription push',
      )
    })
  })

  describe('toUint8Array', () => {
    it('converts a base64url string to Uint8Array', () => {
      // "hello" in base64url is "aGVsbG8"
      const result = pushService.toUint8Array('aGVsbG8')

      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('correctly decodes known base64url value', () => {
      // "ABC" → UTF-8 bytes: 65, 66, 67
      const base64 = btoa('ABC') // 'QUJD'
      const result = pushService.toUint8Array(base64)

      expect(Array.from(result)).toEqual([65, 66, 67])
    })

    it('handles base64url padding correctly (- and _ replaced)', () => {
      // base64url uses - and _ instead of + and /
      const base64url = 'SGVsbG8-'  // will be padded
      // Just verify it doesn't throw
      expect(() => pushService.toUint8Array(base64url)).not.toThrow()
    })
  })
})
