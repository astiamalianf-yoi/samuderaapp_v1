export function WeatherAlertSkeleton() {
  return (
    <article className="bg-white rounded-xl shadow-md p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
        </div>

        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/4 mb-3" />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
            <div className="flex items-center justify-end">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-200 rounded mx-auto" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mt-2 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="mt-2 bg-gray-200 rounded-md p-3">
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>

      <div className="mt-3">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
        <div className="mt-2 bg-gray-200 rounded-md p-3">
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>

      <div className="mt-3 text-right flex justify-end items-center gap-2">
        <div className="h-6 bg-gray-200 rounded w-20" />
        <div className="w-6 h-6 bg-gray-200 rounded-full" />
      </div>
    </article>
  )
}

export default WeatherAlertSkeleton
