import { useCallback, useEffect, useMemo, useState } from "react"
import { pushService } from "../services/pushService"
import type { BeachLocation } from "../types/api"

export function usePushNotifications(selectedBeach?: BeachLocation) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === "undefined" ? "default" : Notification.permission,
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isSupported = useMemo(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
    [],
  )

  const refreshSubscription = useCallback(async () => {
    if (!isSupported) {
      setIsSubscribed(false)
      setIsLoading(false)
      return
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    setIsSubscribed(Boolean(subscription))
    setIsLoading(false)
  }, [isSupported])

  useEffect(() => {
    refreshSubscription()
  }, [refreshSubscription])

  useEffect(() => {
    if (!isSupported || !selectedBeach) return

    const syncBeachPreference = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const target = registration.active ?? navigator.serviceWorker.controller
        target?.postMessage({
          type: "SET_BEACH_PREFERENCE",
          value: selectedBeach,
        })
      } catch {
        // Ignore sync errors to avoid blocking UI.
      }
    }

    syncBeachPreference()
  }, [isSupported, selectedBeach])

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setPermission("default")
      return "default" as NotificationPermission
    }

    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  const subscribe = useCallback(async () => {
    setError(null)

    if (!isSupported) {
      setError("Perangkat tidak mendukung notifikasi push")
      return
    }

    const permissionResult = await requestPermission()
    if (permissionResult !== "granted") {
      setError("Izin notifikasi belum diberikan")
      return
    }

    try {
      setIsLoading(true)
      const publicKey = await pushService.getVapidPublicKey()
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushService.toUint8Array(publicKey),
      })

      await pushService.subscribe(subscription)
      setIsSubscribed(true)
      setPermission("granted")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi")
    } finally {
      setIsLoading(false)
    }
  }, [isSupported, requestPermission, selectedBeach])

  const unsubscribe = useCallback(async () => {
    setError(null)

    if (!isSupported) {
      setError("Perangkat tidak mendukung notifikasi push")
      return
    }

    try {
      setIsLoading(true)
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setIsSubscribed(false)
        return
      }

      await pushService.unsubscribe(subscription.endpoint)
      await subscription.unsubscribe()
      setIsSubscribed(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan notifikasi")
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  return {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  }
}
