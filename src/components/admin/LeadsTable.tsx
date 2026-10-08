'use client'

import { useState } from 'react'
import { Lead } from '@/types/lead'
import type { FieldMap } from '@/types/tenant'
import Badge from '@/components/ui/Badge'
import LeadDrawer from './LeadDrawer'

interface LeadsTableProps {
    leads: Lead[]
    fieldMaps: Record<string, FieldMap>
}

export default function LeadsTable({ leads, fieldMaps }: LeadsTableProps) {
    // Store the id, not the lead. After approve/reject the server
    // re-sends fresh leads, and deriving the active lead from them
    // keeps the open drawer in sync instead of showing a stale copy.
    const [activeId, setActiveId] = useState<string | null>(null)
    const active = leads.find(l => l.id === activeId) ?? null
    const activeFieldMap = active?.tenant_id ? fieldMaps[active.tenant_id] : undefined

    // How many leads this email has sent this tenant, so a repeat contact stands out.
    const seen = new Map<string, number>()
    for (const l of leads) {
        const k = `${l.tenant_id}:${l.email.toLowerCase()}`
        seen.set(k, (seen.get(k) ?? 0) + 1)
    }
    const timesSeen = (l: Lead) => seen.get(`${l.tenant_id}:${l.email.toLowerCase()}`) ?? 1

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
            <div className="mx-8 mb-8 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.008))]">
                <table className="w-full min-w-[820px]">
                    <thead>
                        <tr className="border-b border-white/[0.08]">
                            {['Name', 'At Fault / Context', 'Classification', 'Sentiment', 'Urgency', 'Status', 'Submitted'].map(col => (
                                <th
                                    key={col}
                                    className="px-6 py-4 text-left font-data text-[9px] tracking-[0.2em] text-ghost uppercase font-normal"
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
                                onClick={() => setActiveId(lead.id)}
                                className="border-b border-white/[0.05] last:border-0 cursor-pointer hover:bg-white/[0.03] transition-colors"
                            >
                                <td className="px-6 py-5">
                                    <p className="font-sans text-sm text-ink">{lead.name}</p>
                                    <p className="font-sans text-xs text-ghost mt-0.5">{lead.email}</p>
                                    {timesSeen(lead) > 1 && (
                                        <p className="font-data text-[9px] tracking-[0.15em] text-accent uppercase mt-1.5">
                                            Returning · {timesSeen(lead)} leads
                                        </p>
                                    )}
                                </td>
                                <td className="px-6 py-5 font-sans text-sm text-ghost">
                                    {/* The field can hold a whole paragraph, so cap the width
                                        and truncate. Full text is on hover and in the drawer. */}
                                    <span
                                        className="block max-w-[260px] truncate"
                                        title={lead.company}
                                    >
                                        {lead.company || '—'}
                                    </span>
                                </td>
                                <td className="px-6 py-5">
                                    <Badge value={lead.classification} />
                                </td>
                                <td className="px-6 py-5">
                                    <Badge value={lead.sentiment} />
                                </td>
                                <td className="px-6 py-5 font-data text-sm text-ink">
                                    {lead.urgency_score !== null ? `${lead.urgency_score}/10` : '—'}
                                </td>
                                <td className="px-6 py-5">
                                    <Badge value={lead.status} />
                                </td>
                                <td className="px-6 py-5 font-data text-[10px] text-ghost tracking-wider">
                                    {new Date(lead.created_at).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', year: 'numeric',
                                    })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <LeadDrawer
                lead={active}
                fieldMap={activeFieldMap}
                leadCount={active ? timesSeen(active) : 1}
                onClose={() => setActiveId(null)}
            />
        </>
    )
}