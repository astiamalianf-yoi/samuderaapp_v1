import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest'

// ── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ── fetch mock ───────────────────────────────────────────────────────────────
globalThis.fetch = vi.fn()

// ── crypto.randomUUID mock ───────────────────────────────────────────────────
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234',
  },
  writable: true,
})

// ── Notification mock ────────────────────────────────────────────────────────
Object.defineProperty(globalThis, 'Notification', {
  value: {
    permission: 'default' as NotificationPermission,
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
  writable: true,
})

// ── alert mock ───────────────────────────────────────────────────────────────
globalThis.alert = vi.fn()

// ── Reset mocks between tests ────────────────────────────────────────────────
beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
