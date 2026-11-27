import { useEffect, useState } from 'react';
import { X, ChevronLeft, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import type { IObservation, BeachLocation } from '../types/api';
import { BEACH_LOCATIONS, OBSERVATION_DATA, CATEGORY_LIST } from '../constants/observationData';
import { extractMLCodes } from '../utils/mlCodeExtractor';
import { reportService, ApiError } from '../services/reportService';

interface ReportBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  beachLocation: BeachLocation;
}

type Step = 'category' | 'attribute' | 'condition' | 'summary' | 'success';

export const ReportBottomSheet = ({ isOpen, onClose, beachLocation }: ReportBottomSheetProps) => {
  const [step, setStep] = useState<Step>('category');
  const [selectedBeach, setSelectedBeach] = useState<BeachLocation>(beachLocation);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedAttributeGroup, setSelectedAttributeGroup] = useState<string>('');
  const [observations, setObservations] = useState<IObservation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedBeach(beachLocation);
      setStep('category');
    }
  }, [beachLocation, isOpen]);

  const resetForm = () => {
    setStep('category');
    setSelectedBeach(beachLocation);
    setSelectedCategory('');
    setSelectedAttributeGroup('');
    setObservations([]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setStep('attribute');
  };

  const handleAttributeSelect = (attributeGroup: string) => {
    setSelectedAttributeGroup(attributeGroup);
    setStep('condition');
  };

  const toggleObservation = (obs: IObservation) => {
    setObservations((prev) => {
      const exists = prev.some(
        (o) =>
          o.attribute === obs.attribute && o.object === obs.object && o.value === obs.value
      );
      if (exists) {
        return prev.filter(
          (o) =>
            !(o.attribute === obs.attribute && o.object === obs.object && o.value === obs.value)
        );
      }
      return [...prev, obs];
    });
  };

  const isObservationSelected = (obs: IObservation) => {
    return observations.some(
      (o) =>
        o.attribute === obs.attribute && o.object === obs.object && o.value === obs.value
    );
  };

  const handleSaveObservations = () => {
    if (observations.length === 0) {
      setError('Pilih minimal satu kondisi');
      return;
    }
    setError('');
    setStep('summary');
  };

  const handleAddMore = () => {
    setSelectedAttributeGroup('');
    setStep('category');
  };

  const handleSubmit = async () => {
    if (observations.length === 0) {
      setError('Data tidak lengkap');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const lik_codes = extractMLCodes(observations);
      
      await reportService.submitReport({
        lik_codes,
        beach_location: selectedBeach,
        clientReportId: crypto.randomUUID(),
        createdAtClient: Date.now(),
      });

      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          setStep('success');
          setTimeout(() => {
            handleClose();
          }, 2500);
        } else if (err.statusCode === 502) {
          setError('Layanan ML tidak tersedia');
        } else {
          setError(err.message || 'Terjadi kesalahan saat mengirim laporan');
        }
      } else {
        if (!navigator.onLine) {
          // Laporan diantrekan oleh Background Sync
          setStep('success');
          setTimeout(() => {
            handleClose();
          }, 3500);
        } else {
          setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step === 'attribute') setStep('category');
    else if (step === 'condition') setStep('attribute');
    else if (step === 'summary') setStep('category');
  };

  const currentCategoryData = selectedCategory ? OBSERVATION_DATA[selectedCategory] : null;
  const currentAttributeObservations = currentCategoryData && selectedAttributeGroup 
    ? currentCategoryData[selectedAttributeGroup] 
    : [];
  const selectedBeachLabel = BEACH_LOCATIONS.find((b) => b.value === selectedBeach)?.label;
  const currentCategory = CATEGORY_LIST.find((c) => c.id === selectedCategory);

  if (!isOpen) return null;

  const sheetHeight = step === 'condition' ? 'h-[85vh]' : 'h-[70vh]';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 hw-accelerate"
        onClick={handleClose}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden hw-accelerate ${sheetHeight}`}
        style={{ 
          paddingBottom: 'var(--safe-area-inset-bottom)',
          transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)'
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {(step === 'attribute' || step === 'condition' || step === 'summary') && (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'category' && 'Pilih Kategori'}
              {step === 'attribute' && 'Pilih Atribut/Objek'}
              {step === 'condition' && selectedAttributeGroup}
              {step === 'summary' && 'Ringkasan Laporan'}
              {step === 'success' && 'Laporan Terkirim'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div 
          className="overflow-y-auto h-[calc(100%-6rem)] px-6 py-6 smooth-scroll"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y'
          }}
        >
          {/* Step 1: Category Selection */}
          {step === 'category' && (
            <div className="grid grid-cols-2 gap-4">
              {CATEGORY_LIST.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className="aspect-square p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 touch-optimize flex flex-col items-center justify-center gap-3"
                  style={{ transition: 'border-color 0.2s, background-color 0.2s' }}
                >
                  <span className="text-4xl">{category.icon}</span>
                  <span className="font-medium text-center text-sm">{category.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Attribute/Object Selection (NEW) */}
          {step === 'attribute' && currentCategoryData && (
            <div className="space-y-3">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentCategory?.icon}</span>
                  <div>
                    <div className="text-xs text-blue-600 font-medium">Kategori</div>
                    <div className="text-sm font-bold text-blue-900">{currentCategory?.label}</div>
                  </div>
                </div>
              </div>
              {Object.keys(currentCategoryData).map((attributeGroup) => (
                <button
                  key={attributeGroup}
                  onClick={() => handleAttributeSelect(attributeGroup)}
                  className="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 touch-optimize"
                  style={{ transition: 'border-color 0.2s, background-color 0.2s' }}
                >
                  <span className="font-medium text-gray-900">{attributeGroup}</span>
                  <div className="text-xs text-gray-500 mt-1">
                    {currentCategoryData[attributeGroup].length} kondisi tersedia
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 4: Condition Selection */}
          {step === 'condition' && currentAttributeObservations.length > 0 && (
            <div className="space-y-4">
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">Atribut/Objek</div>
                <div className="text-sm font-bold text-blue-900">{selectedAttributeGroup}</div>
              </div>
              <div className="space-y-2">
                {currentAttributeObservations.map((obs, idx) => {
                  const isSelected = isObservationSelected(obs);
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleObservation(obs)}
                      className={`w-full p-4 text-left border-2 rounded-xl touch-optimize ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{ transition: 'border-color 0.2s, background-color 0.2s' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{obs.label}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleSaveObservations}
                disabled={observations.length === 0}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan ke Laporan ({observations.length})
              </button>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 'summary' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="text-sm text-blue-700 font-medium mb-1">Lokasi Pantai</div>
                <div className="text-lg font-bold text-blue-900">{selectedBeachLabel}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">
                  Tanda Alam yang Dipilih ({observations.length})
                </div>
                <div className="space-y-2">
                  {observations.map((obs, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-900">{obs.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleAddMore}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-blue-600 text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                  Tambah Tanda Lain
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Mengirim...' : '🚀 Kirim Laporan'}
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {!navigator.onLine ? 'Laporan Disimpan Luring!' : 'Laporan Terkirim!'}
              </h3>
              <p className="text-gray-600 text-center mb-2">
                {!navigator.onLine 
                  ? 'Anda sedang offline. Laporan masuk antrean dan akan otomatis dikirim saat koneksi kembali.'
                  : 'Terima kasih atas laporan Anda tentang tanda alam'}
              </p>
              <p className="text-sm text-gray-500 text-center">
                Sistem AI kami akan segera menganalisis informasi ini untuk prakiraan cuaca.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
