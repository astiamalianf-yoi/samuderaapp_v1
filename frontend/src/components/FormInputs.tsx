interface FormFieldProps {
  label: string
  required?: boolean
  children: React.ReactNode
}

export function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  min?: number
  max?: number
  required?: boolean
}

export function NumberInput({ value, onChange, placeholder, min, max, required }: NumberInputProps) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value))}
      placeholder={placeholder}
      min={min}
      max={max}
      required={required}
      className="w-full p-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-700 transition"
    />
  )
}

interface SelectInputProps {
  value: number | string
  onChange: (value: number) => void
  options: readonly { value: number | string; label: string }[]
  placeholder?: string
  required?: boolean
}

export function SelectInput({ value, onChange, options, placeholder, required }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      required={required}
      className="w-full p-3 rounded-lg bg-white border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
    >
      {placeholder && <option value={0}>{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
