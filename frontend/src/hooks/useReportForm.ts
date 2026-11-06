import { useState } from 'react'
import { API_BASE_URL } from '../constants/reportConstants'

interface ReportFormData {
  levelOfInteraction: number
  age: number
  usageDuration: number
  minFrequency: number
  fishingExperience: number
}

interface UseReportFormReturn {
  formData: ReportFormData
  selectedObservations: string[]
  isSubmitting: boolean
  updateField: (field: keyof ReportFormData, value: number) => void
  setSelectedObservations: (observations: string[]) => void
  submitReport: () => Promise<void>
  resetForm: () => void
}

const initialFormData: ReportFormData = {
  levelOfInteraction: 0,
  age: 0,
  usageDuration: 0,
  minFrequency: 0,
  fishingExperience: 0,
}

export function useReportForm(): UseReportFormReturn {
  const [formData, setFormData] = useState<ReportFormData>(initialFormData)
  const [selectedObservations, setSelectedObservations] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (field: keyof ReportFormData, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setSelectedObservations([])
  }

  const submitReport = async () => {
    if (selectedObservations.length === 0) {
      alert('Silakan pilih minimal satu objek pengamatan')
      throw new Error('No observations selected')
    }

    setIsSubmitting(true)
    try {
      const payload = {
        lik_codes: selectedObservations,
        level_of_interaction_with_disaster: formData.levelOfInteraction,
        age: formData.age,
        usage_duration: formData.usageDuration,
        min_frequency_of_usage: formData.minFrequency,
        fishing_experience: formData.fishingExperience,
        clientReportId: crypto.randomUUID(),
        createdAtClient: Date.now(),
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${API_BASE_URL}/api/report`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Gagal mengirim laporan')
      }

      await response.json()
      alert('Laporan berhasil dikirim!')
      resetForm()
    } catch (error) {
      console.error('Error submitting report:', error)
      if (!navigator.onLine) {
        alert('Anda sedang offline. Laporan telah disimpan dan akan dikirim secara otomatis saat koneksi kembali.')
        resetForm()
      } else {
        alert('Gagal mengirim laporan. Silakan coba lagi.')
        throw error
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    formData,
    selectedObservations,
    isSubmitting,
    updateField,
    setSelectedObservations,
    submitReport,
    resetForm,
  }
}
