'use client'

export function StatusDot({ active = true }: { active?: boolean }) {
    return (
        <span className="relative flex h-2 w-2">
            {active && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8102E] opacity-60" />
            )}
            <span
                className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-[#C8102E]' : 'bg-[#333]'
                    }`}
            />
        </span>
    )
}