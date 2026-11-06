import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { usePushNotifications } from '../usePushNotifications'

// Mock pushService
vi.mock('../../services/pushService', () => ({
  pushService: {
    getVapidPublicKey: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    toUint8Array: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  },
}))

import { pushService } from '../../services/pushService'

// ── Service Worker / PushManager mocks ────────────────────────────────────────
const mockSubscription = {
  endpoint: 'https://push.example.com/sub/1',
  unsubscribe: vi.fn().mockResolvedValue(true),
}

const mockPushManager = {
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
}

const mockRegistration = {
  pushManager: mockPushManager,
  active: { postMessage: vi.fn() },
}

const mockServiceWorker = {
  ready: Promise.resolve(mockRegistration),
  controller: { postMessage: vi.fn() },
}

// Inject serviceWorker into navigator
Object.defineProperty(navigator, 'serviceWorker', {
  value: mockServiceWorker,
  writable: true,
})

// Inject PushManager so isSupported = true
Object.defineProperty(window, 'PushManager', {
  value: class PushManager {},
  writable: true,
})

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.mocked(mockPushManager.getSubscription).mockReset()
    vi.mocked(mockPushManager.subscribe).mockReset()
    vi.mocked(mockSubscription.unsubscribe).mockReset().mockResolvedValue(true)
    vi.mocked(pushService.getVapidPublicKey).mockReset()
    vi.mocked(pushService.subscribe).mockReset()
    vi.mocked(pushService.unsubscribe).mockReset()

    // Default: not subscribed
    vi.mocked(mockPushManager.getSubscription).mockResolvedValue(null)
  })

  it('detects browser support correctly', async () => {
    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSupported).toBe(true)
  })

  it('starts with isSubscribed=false when no subscription exists', async () => {
    vi.mocked(mockPushManager.getSubscription).mockResolvedValue(null)

    const { result } = renderHook(() => usePushNotifications())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSubscribed).toBe(false)
  })

  it('starts with isSubscribed=true when subscription already exists', async () => {
    vi.mocked(mockPushManager.getSubscription).mockResolvedValue(mockSubscription)

    const { result } = renderHook(() => usePushNotifications())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isSubscribed).toBe(true)
  })

  it('subscribe flow: requests permission, gets VAPID key, subscribes', async () => {
    vi.mocked(pushService.getVapidPublicKey).mockResolvedValue('test-vapid-key')
    vi.mocked(mockPushManager.subscribe).mockResolvedValue(mockSubscription)
    vi.mocked(pushService.subscribe).mockResolvedValue(undefined)

    // Ensure Notification.permission is 'default' so requestPermission is called
    Object.defineProperty(globalThis.Notification, 'permission', { value: 'default', writable: true })
    vi.mocked(globalThis.Notification.requestPermission).mockResolvedValue('granted')

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.subscribe()
    })

    expect(pushService.getVapidPublicKey).toHaveBeenCalled()
    expect(mockPushManager.subscribe).toHaveBeenCalled()
    expect(pushService.subscribe).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('subscribe sets error when permission is denied', async () => {
    vi.mocked(globalThis.Notification.requestPermission).mockResolvedValue('denied')

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.subscribe()
    })

    expect(result.current.error).toBe('Izin notifikasi belum diberikan')
    expect(result.current.isSubscribed).toBe(false)
  })

  it('subscribe sets error when getVapidPublicKey throws', async () => {
    vi.mocked(globalThis.Notification.requestPermission).mockResolvedValue('granted')
    vi.mocked(pushService.getVapidPublicKey).mockRejectedValue(new Error('VAPID error'))

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.subscribe()
    })

    expect(result.current.error).toBe('VAPID error')
  })

  it('unsubscribe flow: calls pushService.unsubscribe and browser unsubscribe', async () => {
    vi.mocked(mockPushManager.getSubscription)
      .mockResolvedValueOnce(null)       // initial check
      .mockResolvedValueOnce(mockSubscription) // during unsubscribe
    vi.mocked(pushService.unsubscribe).mockResolvedValue(undefined)

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(pushService.unsubscribe).toHaveBeenCalledWith(mockSubscription.endpoint)
    expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    expect(result.current.isSubscribed).toBe(false)
  })

  it('unsubscribe sets isSubscribed=false when there is no active subscription', async () => {
    vi.mocked(mockPushManager.getSubscription).mockResolvedValue(null)

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.unsubscribe()
    })

    // No error, just false
    expect(result.current.isSubscribed).toBe(false)
  })

  it('unsubscribe sets error when pushService.unsubscribe throws', async () => {
    vi.mocked(mockPushManager.getSubscription)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockSubscription)
    vi.mocked(pushService.unsubscribe).mockRejectedValue(new Error('Server error'))

    const { result } = renderHook(() => usePushNotifications())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.unsubscribe()
    })

    expect(result.current.error).toBe('Server error')
  })
})
