import { useParams, useNavigate, Link } from "react-router-dom"
import { MainLayout } from "../components/layout/MainLayout"
import { ArrowLeft, AlertTriangle, CloudRain, Clock, Calendar, MapPin } from "lucide-react"
import { useWeatherAlerts } from "../hooks/useWeatherAlerts"

export function AlertDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { alerts, loading } = useWeatherAlerts()

  // Konversi id ke index
  const alertIndex = id ? parseInt(id, 10) : -1
  const alert = alerts[alertIndex]

  if (loading) {
    return (
      <MainLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6" />
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-8" />
            <div className="space-y-4">
              <div className="h-20 bg-gray-200 rounded" />
              <div className="h-20 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!alert) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Peringatan Tidak Ditemukan</h2>
          <p className="text-gray-500 mb-6">Peringatan cuaca yang Anda cari tidak tersedia.</p>
          <Link
            to="/alerts"
            className="inline-flex items-center gap-2 text-primary font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Peringatan
          </Link>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-primary mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-medium">Kembali</span>
      </button>

    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header */}
      <div className={`p-6 border-b ${
        alert.condition.toLowerCase().includes('hujan') 
        ? 'bg-blue-50 border-blue-100' 
        : 'bg-yellow-50 border-yellow-100'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        {/* Icon dan Kondisi */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className={`p-3 rounded-full ${
            alert.condition.toLowerCase().includes('hujan')
            ? 'bg-blue-100'
            : 'bg-yellow-100'
          }`}>
            <CloudRain className="w-8 h-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full text-sm font-semibold text-primary shadow-sm border border-gray-200">
            <AlertTriangle className="w-4 h-4" />
            {alert.condition}
            </span>
          </div>
        </div>
        
        {/* Informasi Utama */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Peringatan Cuaca
          </h1>
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1.5 font-medium">
            <MapPin className="w-4 h-4 text-primary" />
            {alert.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-gray-500" />
            {alert.date}
            </span>
          </div>
        </div>
        </div>
      </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Waktu Berlaku */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Waktu Mulai</span>
              </div>
              <p className="text-lg font-semibold text-gray-800">{alert.start}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Waktu Berakhir</span>
              </div>
              <p className="text-lg font-semibold text-gray-800">{alert.end}</p>
            </div>
          </div>

          {/* Prakiraan Cuaca */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-primary" />
              Prakiraan Cuaca
            </h2>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{alert.forecast}</p>
            </div>
          </div>

          {/* Rekomendasi */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Rekomendasi
            </h2>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {alert.recommendation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}