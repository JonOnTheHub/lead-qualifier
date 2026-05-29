'use client'

import { useState } from 'react'
import { Lead } from '@/types/lead'
import Badge from '@/components/ui/Badge'
import LeadDrawer from './LeadDrawer'

interface LeadsTableProps {
    leads: Lead[]
}

export default function LeadsTable({ leads }: LeadsTableProps) {
    const [active, setActive] = useState<Lead | null>(null)

    if (leads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32">
                <p className="font-data text-[9px] tracking-[0.2em] text-ghost uppercase">
                    No leads yet
                </p>
            </div>
        )
    }

    return (
        <>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-line">
                        {['Name', 'Company', 'Classification', 'Sentiment', 'Urgency', 'Submitted'].map(col => (
                            <th
                                key={col}
                                className="px-8 py-4 text-left font-data text-[8px] tracking-[0.2em] text-ghost uppercase font-normal"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {leads.map(lead => (
                        <tr
                            key={lead.id}
                            onClick={() => setActive(lead)}
                            className="border-b border-line cursor-pointer hover:bg-surface transition-colors group"
                        >
                            <td className="px-8 py-5">
                                <p className="font-sans text-sm text-ink">{lead.name}</p>
                                <p className="font-sans text-xs text-ghost mt-0.5">{lead.email}</p>
                            </td>
                            <td className="px-8 py-5 font-sans text-sm text-ghost">
                                {lead.company || '—'}
                            </td>
                            <td className="px-8 py-5">
                                <Badge value={lead.classification} />
                            </td>
                            <td className="px-8 py-5">
                                <Badge value={lead.sentiment} />
                            </td>
                            <td className="px-8 py-5 font-data text-sm text-ink">
                                {lead.urgency_score}/10
                            </td>
                            <td className="px-8 py-5 font-data text-[10px] text-ghost tracking-wider">
                                {new Date(lead.created_at).toLocaleDateString('en-GB', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <LeadDrawer lead={active} onClose={() => setActive(null)} />
        </>
    )
}