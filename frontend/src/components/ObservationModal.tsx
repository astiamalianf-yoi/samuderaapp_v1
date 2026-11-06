import { useState, useEffect } from "react"
import { OBSERVATION_OPTIONS } from "../constants/reportConstants"

interface ObservationModalProps {
  isOpen: boolean
  onClose: () => void
  selectedValues: string[]
  onConfirm: (selected: string[]) => void
}

export function ObservationModal({ isOpen, onClose, selectedValues, onConfirm }: ObservationModalProps) {
  const [tempSelections, setTempSelections] = useState<string[]>(selectedValues)

  useEffect(() => {
    if (isOpen) {
      setTempSelections(selectedValues)
    }
  }, [isOpen, selectedValues])

  if (!isOpen) return null

  const handleToggle = (value: string) => {
    setTempSelections(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const handleConfirm = () => {
    onConfirm(tempSelections)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Pilih Objek Pengamatan</h2>
            <p className="text-sm text-gray-500 mt-1">Pilih satu atau lebih tanda yang Anda amati</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
            {OBSERVATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 cursor-pointer hover:bg-blue-50 p-4 transition-colors group"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={tempSelections.includes(option.value)}
                  onChange={() => handleToggle(option.value)}
                  className="mt-1 w-5 h-5 text-blue-700 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-600">{tempSelections.length} tanda dipilih</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition"
            >
              Konfirmasi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
