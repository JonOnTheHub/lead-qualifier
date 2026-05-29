import { Lead } from '@/types/lead'

interface StatsStripProps {
    leads: Lead[]
}

export default function StatsStrip({ leads }: StatsStripProps) {
    const total = leads.length
    const hot = leads.filter(l => l.classification === 'hot').length
    const warm = leads.filter(l => l.classification === 'warm').length
    const cold = leads.filter(l => l.classification === 'cold').length
    const avgUrgency = total
        ? (leads.reduce((sum, l) => sum + (l.urgency_score ?? 0), 0) / total).toFixed(1)
        : '—'

    const stats = [
        { label: 'Total Leads', value: total, accent: false },
        { label: 'Hot', value: hot, accent: true },
        { label: 'Warm', value: warm, accent: false },
        { label: 'Cold', value: cold, accent: false },
        { label: 'Avg Urgency', value: avgUrgency, accent: false },
    ]

    return (
        <div className="grid grid-cols-5 border-b border-line">
            {stats.map((stat, i) => (
                <div
                    key={stat.label}
                    className={`px-8 py-6 ${i < stats.length - 1 ? 'border-r border-line' : ''}`}
                >
                    <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-2">
                        {stat.label}
                    </p>
                    <p className={`font-data text-2xl ${stat.accent ? 'text-accent' : 'text-ink'}`}>
                        {stat.value}
                    </p>
                </div>
            ))}
        </div>
    )
}