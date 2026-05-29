'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Lead } from '@/types/lead'
import Badge from '@/components/ui/Badge'

interface LeadDrawerProps {
    lead: Lead | null
    onClose: () => void
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col gap-1.5 py-4 border-b border-line last:border-0">
            <span className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase">
                {label}
            </span>
            <span className="font-sans text-sm text-ink leading-relaxed">
                {value}
            </span>
        </div>
    )
}

export default function LeadDrawer({ lead, onClose }: LeadDrawerProps) {
    return (
        <AnimatePresence>
            {lead && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 z-40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Drawer — slides in from right */}
                    <motion.div
                        className="fixed top-0 right-0 h-full w-full max-w-lg bg-surface border-l border-line z-50 overflow-y-auto"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-surface border-b border-line px-8 py-6 flex items-start justify-between z-10">
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-accent uppercase mb-2">
                                    Lead Detail
                                </p>
                                <h2 className="font-serif text-xl font-light text-ink">
                                    {lead.name}
                                </h2>
                                <p className="font-sans text-xs text-ghost mt-0.5">
                                    {lead.company} · {lead.email}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="font-data text-[9px] tracking-widest text-ghost hover:text-ink transition-colors uppercase mt-1"
                            >
                                Close
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-8 py-6 space-y-8">

                            {/* Classification + Sentiment */}
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                    AI Assessment
                                </p>
                                <div className="flex items-center gap-3 mb-4">
                                    <Badge value={lead.classification} />
                                    <Badge value={lead.sentiment} />
                                    <span className="font-data text-[9px] text-ghost">
                                        Urgency {lead.urgency_score}/10
                                    </span>
                                    <span className="font-data text-[9px] text-ghost ml-auto">
                                        {Math.round((lead.confidence ?? 0) * 100)}% confidence
                                    </span>
                                </div>
                                <Row label="Reasoning" value={lead.reasoning} />
                            </div>

                            {/* Intent */}
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                    Intent & Needs
                                </p>
                                <Row label="Primary Intent" value={lead.intent} />
                                <div className="py-4 border-b border-line">
                                    <span className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase block mb-3">
                                        Identified Needs
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {lead.needs?.map((need, i) => (
                                            <span
                                                key={i}
                                                className="font-data text-[8px] tracking-wider text-ghost border border-line px-3 py-1.5"
                                            >
                                                {need}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <Row label="Tone Notes" value={lead.tone_notes} />
                            </div>

                            {/* Original Message */}
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                    Original Message
                                </p>
                                <div className="border-l-2 border-accent pl-5">
                                    <p className="font-serif text-sm text-ink/80 leading-relaxed italic">
                                        {lead.message}
                                    </p>
                                </div>
                            </div>

                            {/* Email Draft */}
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                    Drafted Response
                                </p>
                                <div className="bg-background border border-line p-6 space-y-4">
                                    <p className="font-data text-[9px] tracking-wider text-ghost">
                                        Subject: <span className="text-ink">{lead.email_subject}</span>
                                    </p>
                                    <div className="border-t border-line pt-4">
                                        <p className="font-sans text-sm text-ink/80 leading-relaxed whitespace-pre-line">
                                            {lead.email_body}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="border-t border-line pt-6">
                                <Row
                                    label="Submitted"
                                    value={new Date(lead.created_at).toLocaleString('en-GB', {
                                        day: 'numeric', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                    })}
                                />
                                <Row label="Budget" value={lead.budget} />
                                <Row label="Timeline" value={lead.timeline} />
                                <div className="flex gap-4 pt-4">
                                    <span className={`font-data text-[8px] tracking-widest ${lead.email_sent ? 'text-[#6bc98a]' : 'text-ghost'}`}>
                                        {lead.email_sent ? '✓ Email Sent' : '✗ Email Failed'}
                                    </span>
                                    <span className={`font-data text-[8px] tracking-widest ${lead.slack_notified ? 'text-[#6bc98a]' : 'text-ghost'}`}>
                                        {lead.slack_notified ? '✓ Slack Notified' : '✗ Slack Failed'}
                                    </span>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}