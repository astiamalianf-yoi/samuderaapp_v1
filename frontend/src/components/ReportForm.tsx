import { useState } from 'react';
import type { BeachLocation } from '../types/api';
import { reportService, ApiError } from '../services/reportService';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReportFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const BEACH_LOCATIONS: { value: BeachLocation; label: string }[] = [
  { value: 'pantai_depok', label: 'Pantai Depok' },
  { value: 'pantai_lampuuk', label: 'Pantai Lampuuk' },
  { value: 'pantai_lhoknga', label: 'Pantai Lhoknga' },
  { value: 'pantai_ulee_lheue', label: 'Pantai Ulee Lheue' },
  { value: 'pantai_samas', label: 'Pantai Samas' },
];

const OBSERVATION_OPTIONS = [
  { value: 'wn-1', label: '🌊 Gelombang Tinggi' },
  { value: 'wn-2', label: '💨 Angin Kencang' },
  { value: 'wn-3', label: '⛈️ Hujan Lebat' },
  { value: 'wn-4', label: '🌩️ Petir' },
  { value: 'wn-5', label: '🌫️ Kabut Tebal' },
  { value: 'wn-6', label: '🌀 Arus Kuat' },
  { value: 'wn-7', label: '⚠️ Air Surut Drastis' },
  { value: 'wn-8', label: '🦈 Hewan Laut Tidak Biasa' },
];

export const ReportForm = ({ onSuccess, onCancel }: ReportFormProps) => {
  const [beachLocation, setBeachLocation] = useState<BeachLocation>('pantai_depok');
  const [selectedObservations, setSelectedObservations] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const toggleObservation = (value: string) => {
    setSelectedObservations(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedObservations.length === 0) {
      setError('Pilih minimal satu objek pengamatan');
      return;
    }

    setIsSubmitting(true);

    try {
      await reportService.submitReport({
        lik_codes: selectedObservations,
        beach_location: beachLocation,
        clientReportId: crypto.randomUUID(),
        createdAtClient: Date.now(),
      });
      
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setError('Anda harus login terlebih dahulu');
        } else if (err.statusCode === 400) {
          setSuccess(true);
          setTimeout(() => {
            onSuccess?.();
          }, 1500);
        } else if (err.statusCode === 502) {
          setError('Layanan ML tidak tersedia');
        } else {
          setError(err.message || 'Terjadi kesalahan saat mengirim laporan');
        }
      } else {
        setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Laporan Terkirim!</h3>
        <p className="text-gray-600 text-center">
          Terima kasih atas laporan Anda. Sistem AI kami akan segera menganalisis informasi ini.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Beach Location */}
      <div>
        <label htmlFor="beach-location" className="block text-sm font-medium text-gray-700 mb-2">
          Lokasi Pantai <span className="text-red-500">*</span>
        </label>
        <select
          id="beach-location"
          value={beachLocation}
          onChange={(e) => setBeachLocation(e.target.value as BeachLocation)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900"
        >
          {BEACH_LOCATIONS.map(location => (
            <option key={location.value} value={location.value}>
              {location.label}
            </option>
          ))}
        </select>
      </div>

      {/* Observations */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Objek Pengamatan <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OBSERVATION_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleObservation(option.value)}
              className={`px-4 py-3 rounded-lg border-2 text-left transition-all ${
                selectedObservations.includes(option.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
        {selectedObservations.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {selectedObservations.length} tanda dipilih
          </p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || selectedObservations.length === 0}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}
        </button>
      </div>
    </form>
  );
};
