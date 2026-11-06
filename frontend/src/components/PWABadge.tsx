import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWABadge() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r) {
      // SW registered
    },
    onRegisterError(_error) {
      // SW registration error
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  useEffect(() => {
    if (offlineReady && !needRefresh) {
      const timer = setTimeout(() => {
        setOfflineReady(false)
      }, 4500)
      return () => clearTimeout(timer)
    }
  }, [offlineReady, needRefresh, setOfflineReady])

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-0 right-0 left-0 p-4 z-50 md:bottom-4 md:right-4 md:left-auto md:w-96 transform transition-all duration-500 ease-in-out translate-y-0">
      <div className="bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden" role="alert">
        <div className="p-4 sm:p-5">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  {needRefresh ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </span>
            </div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              <p className="text-sm font-bold text-gray-900">
                {needRefresh ? "Pembaruan Tersedia" : "Aplikasi Siap"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {needRefresh
                  ? "Versi terbaru SAMUDRA telah tersedia. Muat ulang untuk memperbarui."
                  : "Aplikasi sudah diunduh dan siap digunakan saat offline."}
              </p>
              <div className="mt-3 flex space-x-3">
                {needRefresh && (
                  <button
                    type="button"
                    onClick={() => updateServiceWorker(true)}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Muat Ulang
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => close()}
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
