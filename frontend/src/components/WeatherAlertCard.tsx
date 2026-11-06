import { ArrowRight, AlertTriangle, CloudRain } from "lucide-react"
import { Link } from "react-router-dom"

export interface WeatherAlertProps {
  location: string
  date: string
  start: string
  end: string
  condition: string
  forecast: string
  recommendation: string
  loading?: boolean
  id?: number // Tambahkan id sebagai index
}

export function WeatherAlertCard({
  location,
  date,
  start,
  end,
  condition,
  forecast,
  recommendation,
  loading,
  id,
}: WeatherAlertProps) {
  if (loading) {
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
          <div className="mt-2 bg-gray-200 rounded-md p-3 text-sm text-gray-700">
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        </div>

        <div className="mt-3">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
          <div className="mt-2 bg-gray-200 rounded-md p-3 text-sm text-gray-700">
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

  return (
    <article className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" aria-hidden />
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-sm font-semibold">Peringatan Cuaca {location}</h2>
          <p className="text-xs text-gray-500">{date}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500">Mulai</p>
              <p className="font-semibold">{start}</p>
              <p className="text-xs text-gray-500 mt-2">Berakhir</p>
              <p className="font-semibold">{end}</p>
            </div>
            <div className="flex items-center justify-end">
              <div className="text-center">
                <CloudRain className="w-12 h-12 text-primary" aria-hidden />
                <p className="text-sm text-primary mt-1">{condition}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold">Prakiraan Cuaca</p>
        <div className="mt-2 bg-gray-100 rounded-md p-3 text-sm text-gray-700">
          {forecast.length > 175 ? `${forecast.slice(0, 200)}...` : forecast}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm font-semibold">Rekomendasi</p>
        <div className="mt-2 bg-gray-100 rounded-md p-3 text-sm text-gray-700">
          {recommendation}
        </div>
      </div>

      <div className="mt-3 text-right">
        <Link
          to={`/alerts/${id ?? 0}`}
          className="text-sm text-primary font-semibold inline-flex items-center gap-2 hover:text-primary/80 transition-colors"
        >
          Lihat Detail
          <span className="w-6 h-6 flex items-center justify-center bg-primary text-white rounded-full">
            <ArrowRight className="w-3 h-3" aria-hidden />
          </span>
        </Link>
      </div>
    </article>
  )
}

export default WeatherAlertCard