'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lead } from '@/types/lead'
import type { FieldMap } from '@/types/tenant'
import Badge from '@/components/ui/Badge'
import { fieldRows } from '@/lib/fields'
import { approveLead, rejectLead } from '@/app/admin/actions'

interface LeadDrawerProps {
    lead: Lead | null
    fieldMap?: FieldMap
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

// ─────────────────────────────────────────────
// REVIEW PANEL
// Editable draft + approve/reject. Mounted with key={lead.id}
// so its local state (the edited subject/body) initializes
// fresh for each lead instead of leaking between them.
// ─────────────────────────────────────────────

function ReviewPanel({ lead }: { lead: Lead }) {
    const [subject, setSubject] = useState(lead.email_subject)
    const [body, setBody] = useState(lead.email_body)
    const [error, setError] = useState<string | null>(null)

    // useTransition gives us a pending flag while the server action runs,
    // so we can disable the buttons and block double submits client-side.
    // (The DB claim in approveLead is the real guard. This is just UX.)
    const [pending, startTransition] = useTransition()

    function run(action: () => Promise<{ ok: boolean; error?: string }>) {
        setError(null)
        startTransition(async () => {
            const res = await action()
            if (!res.ok) setError(res.error ?? 'Something went wrong')
            // On success the server revalidates /admin, the lead's status
            // changes, and this panel unmounts on its own.
        })
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase block">
                    Subject
                </label>
                <input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    disabled={pending}
                    className="w-full bg-background border border-line px-4 py-3 font-sans text-sm text-ink focus:outline-none focus:border-accent disabled:opacity-50"
                />
            </div>

            <div className="space-y-2">
                <label className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase block">
                    Body
                </label>
                <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    disabled={pending}
                    rows={14}
                    className="w-full bg-background border border-line p-4 font-sans text-sm text-ink leading-relaxed focus:outline-none focus:border-accent disabled:opacity-50"
                />
            </div>

            {error && (
                <p className="font-data text-[9px] tracking-wider text-[#ff6b6b]">
                    {error}
                </p>
            )}

            <div className="flex gap-3 pt-2">
                <button
                    onClick={() => run(() => approveLead(lead.id, subject, body))}
                    disabled={pending}
                    className="flex-1 bg-accent text-background font-data text-[9px] tracking-[0.2em] uppercase px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {pending ? 'Working…' : lead.status === 'send_failed' ? 'Retry Send' : 'Approve & Send'}
                </button>
                <button
                    onClick={() => {
                        if (window.confirm('Reject this lead? No email will be sent.')) {
                            run(() => rejectLead(lead.id))
                        }
                    }}
                    disabled={pending}
                    className="border border-line text-ghost hover:text-ink font-data text-[9px] tracking-[0.2em] uppercase px-6 py-3.5 transition-colors disabled:opacity-50"
                >
                    Reject
                </button>
            </div>
        </div>
    )
}

export default function LeadDrawer({ lead, fieldMap, onClose }: LeadDrawerProps) {
    const reviewable =
        lead?.status === 'pending_review' || lead?.status === 'send_failed'

    // The lead's raw answers, labeled by its tenant's config. Legacy rows
    // were backfilled into `fields`, so this works for them too.
    const submissionRows = lead ? fieldRows(fieldMap, lead.fields ?? {}) : []

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
                        {/* Header — email only. Long free-text answers live in
                            the Submission section, not up here. */}
                        <div className="sticky top-0 bg-surface border-b border-line px-8 py-6 flex items-start justify-between z-10">
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-accent uppercase mb-2">
                                    Lead Detail
                                </p>
                                <h2 className="font-serif text-xl font-light text-ink">
                                    {lead.name}
                                </h2>
                                <p className="font-sans text-xs text-ghost mt-0.5">
                                    {lead.email}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="font-data text-[9px] tracking-widest text-ghost hover:text-ink transition-colors uppercase mt-1"
                                >
                                    Close
                                </button>
                                <Badge value={lead.status} />
                            </div>
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

                            {/* Submission — the rest of the form answers, labeled and
                                formatted by the lead's tenant config. Hidden if empty. */}
                            {submissionRows.length > 0 && (
                                <div>
                                    <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                        Submission
                                    </p>
                                    {submissionRows.map(row => (
                                        <Row key={row.key} label={row.label} value={row.value} />
                                    ))}
                                </div>
                            )}

                            {/* Email Draft — editable while reviewable, read-only after */}
                            <div>
                                <p className="font-data text-[8px] tracking-[0.2em] text-ghost uppercase mb-4">
                                    {reviewable ? 'Review Draft' : 'Drafted Response'}
                                </p>

                                {reviewable ? (
                                    <ReviewPanel key={lead.id} lead={lead} />
                                ) : (
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
                                )}
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
                                {lead.reviewed_at && (
                                    <Row
                                        label="Reviewed"
                                        value={new Date(lead.reviewed_at).toLocaleString('en-GB', {
                                            day: 'numeric', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    />
                                )}
                                {lead.send_error && (
                                    <Row label="Last Send Error" value={lead.send_error} />
                                )}
                                <div className="flex gap-4 pt-4">
                                    <span className={`font-data text-[8px] tracking-widest ${lead.email_sent ? 'text-[#6bc98a]' : 'text-ghost'}`}>
                                        {lead.email_sent ? '✓ Email Sent' : '— Email Not Sent'}
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