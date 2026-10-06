import { Lead } from '@/types/lead'

interface StatsStripProps {
    leads: Lead[]
}

export default function StatsStrip({ leads }: StatsStripProps) {
    const total = leads.length
    const hot = leads.filter(l => l.classification === 'hot').length
    const warm = leads.filter(l => l.classification === 'warm').length
    const cold = leads.filter(l => l.classification === 'cold').length
    // The one number that tells you what to do next: drafts waiting on a person.
    const awaiting = leads.filter(
        l => l.status === 'pending_review' || l.status === 'send_failed',
    ).length
    const avgUrgency = total
        ? (leads.reduce((sum, l) => sum + (l.urgency_score ?? 0), 0) / total).toFixed(1)
        : '—'

    const stats = [
        { label: 'Awaiting review', value: awaiting, primary: true },
        { label: 'Total leads', value: total },
        { label: 'Hot', value: hot, accent: true },
        { label: 'Warm', value: warm },
        { label: 'Cold', value: cold },
        { label: 'Avg urgency', value: avgUrgency },
    ]

    return (
        <div className="grid grid-cols-2 gap-3 px-8 py-6 sm:grid-cols-7">
            {stats.map(stat => (
                <div
                    key={stat.label}
                    className={`rounded-2xl border bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${
                        stat.primary
                            ? 'col-span-2 border-accent/40'
                            : 'border-white/[0.08]'
                    }`}
                >
                    <p className="font-data text-[9px] tracking-[0.2em] text-ghost uppercase mb-2">
                        {stat.label}
                    </p>
                    <p
                        className={`font-data text-3xl ${
                            stat.primary || stat.accent ? 'text-accent' : 'text-ink'
                        }`}
                    >
                        {stat.value}
                    </p>
                </div>
            ))}
        </div>
    )
}