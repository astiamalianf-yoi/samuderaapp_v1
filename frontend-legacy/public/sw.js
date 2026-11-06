importScripts("/build-id.js");

const CACHE_NAME = "peringatan-" + self.BUILD_ID;

const STATIC_EXTS = [".js", ".css", ".woff2", ".ttf", ".png", ".jpg", ".svg", ".ico", ".webp"];
const API_GET_PATHS = ["/api/alerts", "/api/bmkg", "/api/health"];
const OFFLINE_HTML = '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CuacaPesisir - Offline</title><style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#F8F6F0;color:#0A2540;text-align:center;padding:1rem}.container{max-width:400px}h1{font-size:1.25rem;margin-bottom:0.5rem}p{font-size:0.875rem;opacity:0.6;margin-bottom:1.5rem}button{background:#0EA5E9;color:#fff;border:none;padding:0.75rem 1.5rem;border-radius:0.75rem;font-size:1rem;font-weight:600;cursor:pointer}</style></head><body><div class="container"><h1>Anda sedang offline</h1><p>CuacaPesisir membutuhkan koneksi internet untuk memuat data terbaru. Silakan periksa koneksi Anda dan coba lagi.</p><button onclick="location.reload()">Coba Lagi</button></div></body></html>';

function isStaticAsset(pathname) {
	return STATIC_EXTS.some((ext) => pathname.endsWith(ext));
}

function isApiGet(pathname) {
	return API_GET_PATHS.some((p) => pathname.startsWith(p));
}

function offlineJson() {
	return new Response(JSON.stringify({ error: "Tidak ada koneksi" }), {
		headers: { "Content-Type": "application/json" },
		status: 503,
	});
}

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
		)
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	if (isStaticAsset(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => {
				if (cached) return cached;
				return fetch(request).then((response) => {
					if (response.ok) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				});
			})
		);
		return;
	}

	if (request.method === "GET" && isApiGet(url.pathname)) {
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.status === 200) {
						const clone = response.clone();
						caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					}
					return response;
				})
				.catch(() =>
					caches.match(request).then((cached) => {
						if (cached) {
							const dateHeader = cached.headers.get("date");
							if (dateHeader) {
								const age = Date.now() - new Date(dateHeader).getTime();
								if (age < 3600000) return cached;
							}
						}
						return offlineJson();
					})
				)
		);
		return;
	}

	if (request.method !== "GET" && url.pathname.startsWith("/api/")) {
		event.respondWith(
			fetch(request).catch(() => offlineJson())
		);
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			caches.match(request).then((cached) => {
				const fetchPromise = fetch(request)
					.then((response) => {
						if (response.ok) {
							const clone = response.clone();
							caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
						}
						return response;
					})
					.catch(() => undefined);

				if (cached) {
					fetchPromise.catch(() => {});
					return cached;
				}

				return fetchPromise.then((response) => {
					if (response) return response;
					return new Response(OFFLINE_HTML, {
						headers: { "Content-Type": "text/html; charset=utf-8" },
						status: 503,
					});
				});
			})
		);
		return;
	}

	event.respondWith(
		fetch(request).catch(() => caches.match(request))
	);
});

const DB_NAME = "peringatan-db";
const DB_VERSION = 1;
const STORE_NAME = "preferences";

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function setPreference(key, value) {
	const db = await openDb();
	const tx = db.transaction(STORE_NAME, "readwrite");
	tx.objectStore(STORE_NAME).put(value, key);
	return new Promise((resolve, reject) => {
		tx.oncomplete = resolve;
		tx.onerror = () => reject(tx.error);
	});
}

async function getPreference(key) {
	const db = await openDb();
	const tx = db.transaction(STORE_NAME, "readonly");
	const req = tx.objectStore(STORE_NAME).get(key);
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

self.addEventListener("push", (event) => {
	const payload = event.data?.json() ?? {};
	const title = payload.title || "Peringatan Cuaca";
	const options = {
		body: payload.body || "Ada peringatan cuaca baru untuk pantai Anda.",
		icon: "/icon-192x192.png",
		badge: "/icon-72x72.png",
		tag: payload.tag || "default",
		data: {
			url: payload.url || "/",
			beach: payload.beach || "",
		},
		vibrate: [100, 50, 100],
	};
	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || "/";
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.includes(url) && "focus" in client) {
					return client.focus();
				}
			}
			return self.clients.openWindow(url);
		})
	);
});

self.addEventListener("pushsubscriptionchange", (event) => {
	event.waitUntil(
		(async () => {
			const subscription = await self.registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: await getPreference("vapidKey"),
			});
			const beach = await getPreference("beach");
			await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ subscription: subscription.toJSON(), beach_location: beach }),
			});
		})()
	);
});
