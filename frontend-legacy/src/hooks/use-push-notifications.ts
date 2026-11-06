"use client";

import { useState, useEffect, useCallback } from "react";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "@/lib/api";

type PushState = {
  permission: NotificationPermission;
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: (beach?: string) => Promise<void>;
  unsubscribe: () => Promise<void>;
  mounted: boolean;
  subscribedBeach: string | null;
};

export function usePushNotifications(selectedBeach?: string | null): PushState {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [subscribedBeach, setSubscribedBeach] = useState<string | null>(null);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    setPermission(Notification.permission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
        if (sub) {
          const beach = await getDbPreference("beach");
          setSubscribedBeach(beach);
        }
      } catch {
        // SW not ready yet
      }
    })();
  }, [isSupported]);

  const subscribe = useCallback(async (beachOverride?: string) => {
    if (!isSupported) return;
    const beach = beachOverride ?? selectedBeach;
    setIsLoading(true);
    setError(null);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Izin notifikasi ditolak");
        setIsLoading(false);
        return;
      }

      const vapidKey = await getVapidPublicKey();
      if (!vapidKey) {
        setError("Server notifikasi belum dikonfigurasi");
        setIsLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await subscribePush(subscription.toJSON(), beach ?? "all");
      setIsSubscribed(true);
      if (beach) setSubscribedBeach(beach);

      const db = await openDb();
      const tx = db.transaction("preferences", "readwrite");
      const store = tx.objectStore("preferences");
      if (beach) store.put(beach, "beach");
      store.put(vapidKey, "vapidKey");
    } catch (err) {
      setError("Gagal mengaktifkan notifikasi");
      console.error("Push subscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, selectedBeach]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      setSubscribedBeach(null);
    } catch (err) {
      setError("Gagal menonaktifkan notifikasi");
      console.error("Push unsubscribe error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe, mounted, subscribedBeach };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("peringatan-db", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("preferences")) {
        db.createObjectStore("preferences");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getDbPreference(key: string): Promise<string | null> {
  return openDb().then((db) => {
    return new Promise<string | null>((resolve) => {
      const tx = db.transaction("preferences", "readonly");
      const req = tx.objectStore("preferences").get(key);
      req.onsuccess = () => resolve((req.result as string | null) ?? null);
      req.onerror = () => resolve(null);
    });
  }).catch(() => null);
}
