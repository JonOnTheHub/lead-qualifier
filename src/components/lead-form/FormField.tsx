'use client'

interface FormFieldProps {
    label: string
    name: string
    type?: 'text' | 'email' | 'textarea' | 'select'
    placeholder?: string
    options?: { value: string; label: string }[]
    value: string
    onChange: (value: string) => void
    error?: string
    required?: boolean
}

export function FormField({
    label, name, type = 'text', placeholder,
    options, value, onChange, error, required,
}: FormFieldProps) {
    const baseInput = `
    w-full bg-transparent border-b border-[#222] 
    text-[#F0EBE1] font-[family-name:var(--font-sans)] font-light
    text-sm py-3 px-0 placeholder:text-[#333]
    focus:outline-none focus:border-[#C8102E] 
    transition-colors duration-300
  `

    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor={name}
                className="font-[family-name:var(--font-data)] text-[10px] 
          tracking-[0.2em] text-[#555] uppercase"
            >
                {label}{required && <span className="text-[#C8102E] ml-1">*</span>}
            </label>

            {type === 'textarea' ? (
                <textarea
                    id={name}
                    name={name}
                    rows={4}
                    placeholder={placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={`${baseInput} resize-none`}
                />
            ) : type === 'select' ? (
                <select
                    id={name}
                    name={name}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={`${baseInput} cursor-pointer`}
                >
                    <option value="" disabled className="bg-[#0f0f0f]">Select</option>
                    {options?.map(o => (
                        <option key={o.value} value={o.value} className="bg-[#0f0f0f]">
                            {o.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    id={name}
                    name={name}
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={baseInput}
                />
            )}

            {error && (
                <p className="font-[family-name:var(--font-data)] text-[10px] 
          tracking-widest text-[#C8102E]">
                    {error}
                </p>
            )}
        </div>
    )
}