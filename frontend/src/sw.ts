/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching"
import { clientsClaim } from "workbox-core"
import type { PrecacheEntry } from "workbox-precaching"
import { API_BASE_URL, API_HOST } from "./config"

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: PrecacheEntry[]
}

type PushPayload = {
  title?: string
  body?: string
  url?: string
  data?: Record<string, unknown>
  tag?: string
  beach_location?: string
  beach?: string
}

type HistoryItem = {
  id?: string
  alertId?: string
  reportId?: string
  serverTimestamp?: number
  decision?: {
    shouldDistribute?: boolean
    action?: string
    is_multisign?: boolean
    is_actionable?: boolean
  }
  ml?: {
    action?: string
    recommendation?: string
    description?: string
  }
  beach_location?: string
  input?: {
    beach_location?: string
    lik_codes?: string[]
  }
}

const DB_NAME = "samudra-push"
const STORE_NAME = "preferences"
const BEACH_KEY = "selectedBeach"
const LAST_SEEN_PREFIX = "lastSeen:"
const HISTORY_URL = `${API_BASE_URL}/api/history?distributed=true&limit=10`

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const setPreference = async (key: string, value: string) => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const getPreference = async (key: string) => {
  const db = await openDb()
  return new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
}

const normalizeTimestamp = (timestamp?: number) => {
  if (!timestamp) return 0
  return timestamp < 1e12 ? timestamp * 1000 : timestamp
}

const getLastSeen = async (beach: string) => {
  const raw = await getPreference(`${LAST_SEEN_PREFIX}${beach}`)
  return raw ? Number(raw) || 0 : 0
}

const setLastSeen = async (beach: string, timestamp: number) => {
  await setPreference(`${LAST_SEEN_PREFIX}${beach}`, String(timestamp))
}

const formatBeachLabel = (value: string) =>
  value
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")

const resolveBeachValue = (item: HistoryItem) =>
  item.beach_location ?? item.input?.beach_location

const fetchLatestDistributed = async (selectedBeach: string) => {
  const response = await fetch(HISTORY_URL, { cache: "no-store" })
  if (!response.ok) return null

  const data = (await response.json()) as { items?: HistoryItem[] } | HistoryItem[]
  const items = Array.isArray(data) ? data : data.items ?? []
  const filtered = items.filter((item) =>
    item.decision?.shouldDistribute && resolveBeachValue(item) === selectedBeach
  )

  if (filtered.length === 0) return null

  return filtered.reduce((latest, current) =>
    normalizeTimestamp(current.serverTimestamp) > normalizeTimestamp(latest.serverTimestamp)
      ? current
      : latest
  )
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ==========================================
// PWA Runtime Caching Strategies
// ==========================================

// Enable offline SPA routing by serving index.html for navigation requests
try {
  const handler = createHandlerBoundToURL('index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [
      new RegExp('^/bmkg'),
      new RegExp('^/bmkg-api'),
      new RegExp('^/api'),
      new RegExp('/[^/]+\\.[^/]+$'),
    ]
  });
  registerRoute(navigationRoute);
} catch (error) {
  console.error('Error registering navigation route', error);
}

import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { OBSERVATION_OPTIONS } from './constants/reportConstants';

// Map background (OpenStreetMap tiles, requested with CORS) - CacheFirst: after the first visit the map opens from the
// phone, also with a weak signal or offline. Tiles change rarely; 30 days, up to ~3000 tiles (~60 MB).
registerRoute(
  ({ url }) => url.hostname === 'tile.openstreetmap.org',
  new CacheFirst({
    cacheName: 'map-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  })
);

// Cache BMKG APIs (Forecast and RSS) - StaleWhileRevalidate
registerRoute(
  ({ url }) => url.href.includes('api.bmkg.go.id') || url.href.includes('data.bmkg.go.id') || url.pathname.startsWith('/bmkg'),
  new StaleWhileRevalidate({
    cacheName: 'bmkg-api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 6 * 60 * 60, // 6 hours
      }),
    ],
  })
);

// Cache Backend API (History, Alerts) - NetworkFirst
registerRoute(
  ({ url }) => url.host === API_HOST && url.pathname.startsWith('/api') && !url.pathname.startsWith('/api/report'),
  new NetworkFirst({
    cacheName: 'backend-api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

// Take control of open pages as soon as this worker is active, so that a report sent without
// signal on the very first visit is queued by the worker below (found 16 Nov 2026).
clientsClaim()

// Background Sync for Offline Reports
const bgSyncPlugin = new BackgroundSyncPlugin('report-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 Hours
  // Replay one by one; a report answered "too many" (429) or with a server error stays in the
  // queue and is tried again at the next sync, instead of being dropped (found 16 Nov 2026).
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shiftRequest())) {
      try {
        const res = await fetch(entry.request.clone())
        if (res.status === 429 || res.status >= 500) {
          await queue.unshiftRequest(entry)
          throw new Error(`report replay deferred: ${res.status}`)
        }
      } catch (err) {
        if (!(err instanceof Error && err.message.startsWith("report replay deferred"))) {
          await queue.unshiftRequest(entry)
        }
        throw err
      }
    }
  },
});

registerRoute(
  ({ url }) => url.host === API_HOST && url.pathname.startsWith('/api/report'),
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; value?: string; payload?: unknown } | null
  if (!data) return

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }

  if (data.type === "SET_BEACH_PREFERENCE" && data.value) {
    event.waitUntil(setPreference(BEACH_KEY, data.value))
    return
  }

  if (data.type === "SHOW_WEATHER_ALERT" && data.payload) {
    const p = data.payload as PushPayload
    event.waitUntil(
      self.registration.showNotification(p.title ?? "Peringatan Cuaca BMKG", {
        body: p.body,
        data: p.data,
        tag: p.tag,
        icon: "/192x192.png",
      })
    )
    return
  }
})

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload: PushPayload | undefined
      try {
        payload = event.data?.json() as PushPayload
      } catch {
        payload = undefined
      }

      // Delivery receipt: when the server put its send time in the push, tell it when the push
      // arrived (push latency for the performance test; never blocks the notification).
      const sentAt = (payload as { sentAt?: unknown } | undefined)?.sentAt
      const ackId = (payload as { alertId?: unknown } | undefined)?.alertId
      if (typeof sentAt === "number" && typeof ackId === "string") {
        fetch(`${API_BASE_URL}/api/ack`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertId: ackId, transport: "PUSH", ackStage: "DELIVERED", serverTimestamp: sentAt, receivedAtClient: Date.now() }),
        }).catch(() => undefined)
      }

      // Performance-test push: always shown under one tag, so a series replaces itself.
      if ((payload as { type?: unknown } | undefined)?.type === "PERF_TEST") {
        await self.registration.showNotification(payload?.title ?? "Uji kecepatan SAMUDRA", {
          body: payload?.body ?? "Pesan uji, abaikan.",
          tag: "samudra-perf",
          silent: true,
          data: { url: "/" },
        })
        return
      }

      const payloadData = payload?.data as { beach_location?: string; beach?: string } | undefined
      const payloadBeach = payload?.beach_location ?? payload?.beach ?? payloadData?.beach_location ?? payloadData?.beach

      let selectedBeach: string | null = null
      try {
        selectedBeach = await getPreference(BEACH_KEY)
      } catch {
        selectedBeach = null
      }

      if (selectedBeach) {
        if (payloadBeach && payloadBeach !== selectedBeach) {
          return
        }

        const isSilentPush = !payload?.title && !payload?.body;
        if (isSilentPush || !payloadBeach) {
          try {
            const latest = await fetchLatestDistributed(selectedBeach)
            if (!latest) return

            const latestTimestamp = normalizeTimestamp(latest.serverTimestamp)
            const lastSeen = await getLastSeen(selectedBeach)
            if (latestTimestamp <= lastSeen) return

            const isActionable = latest.decision?.is_actionable === false;
            const actionLabel = isActionable ? "⚠️ Perlu Tindakan" : "✅ Perlu Kewaspadaan"
            const beachLabel = formatBeachLabel(selectedBeach)

            const likCodes = latest.input?.lik_codes || []
            const tandaAlamText = likCodes.map(code => {
              const opt = OBSERVATION_OPTIONS.find(o => o.value.toLowerCase() === code.toLowerCase())
              return opt ? opt.label : code
            }).join(', ')

            const recommendation = latest.ml?.recommendation
              ?? (isActionable
                ? "Segera hindari area pantai dan berlindung di tempat aman."
                : "Tetap waspada dan pantau perkembangan cuaca.")

            const title = `${beachLabel} - ${actionLabel}`
            const body = `Tanda Alam: ${tandaAlamText || 'Tidak ada spesifikasi'}\nRekomendasi: ${recommendation}`

            await self.registration.showNotification(title, {
              body,
              data: {
                url: "/",
                reportId: latest.reportId ?? latest.id,
                alertId: latest.alertId,
                beach: selectedBeach,
              },
              tag: latest.reportId ? `history-${latest.reportId}` : undefined,
            })

            await setLastSeen(selectedBeach, latestTimestamp)
            return
          } catch {
            return
          }
        }
      }

      const title = payload?.title ?? "Peringatan Tanda Alam"
      const options: NotificationOptions = {
        body: payload?.body ?? "Ada laporan baru yang perlu diperhatikan.",
        data: {
          url: payload?.url ?? "/",
          ...(payload?.data ?? {}),
        },
        tag: payload?.tag,
      }

      await self.registration.showNotification(title, options)
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url ?? "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }

      return undefined
    })
  )
})
