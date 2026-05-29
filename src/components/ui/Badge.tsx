import { LeadClassification } from '@/types/lead'

const config: Record<LeadClassification, { label: string; color: string }> = {
    hot: { label: 'HOT', color: 'text-[#C8102E] border-[#C8102E]/40 bg-[#C8102E]/8' },
    warm: { label: 'WARM', color: 'text-[#D4A847] border-[#D4A847]/40 bg-[#D4A847]/8' },
    cold: { label: 'COLD', color: 'text-[#4A8FA8] border-[#4A8FA8]/40 bg-[#4A8FA8]/8' },
    unqualified: { label: 'UNQUALIFIED', color: 'text-[#555555] border-[#333333]   bg-[#111111]' },
}

export function Badge({ classification }: { classification: LeadClassification }) {
    const { label, color } = config[classification]
    return (
        <span
            className={`font-[family-name:var(--font-data)] text-[10px] tracking-[0.2em] 
        px-2.5 py-1 border rounded-sm ${color}`}
        >
            {label}
        </span>
    )
}