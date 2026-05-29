'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FormField } from './FormField'
import { SubmitButton } from './SubmitButton'
import { RawLeadFormData, QualifyApiResponse } from '@/types/lead'

const BUDGET_OPTIONS = [
    { value: 'under-5k', label: 'Under $5,000' },
    { value: '5k-15k', label: '$5,000 – $15,000' },
    { value: '15k-50k', label: '$15,000 – $50,000' },
    { value: '50k-plus', label: '$50,000+' },
    { value: 'undisclosed', label: 'Prefer not to say' },
]

const TIMELINE_OPTIONS = [
    { value: 'asap', label: 'As soon as possible' },
    { value: '1-month', label: 'Within 1 month' },
    { value: '1-3-months', label: '1 – 3 months' },
    { value: '3-6-months', label: '3 – 6 months' },
    { value: 'flexible', label: 'Flexible' },
]

const EMPTY: RawLeadFormData = {
    name: '', email: '', company: '',
    budget: '', timeline: '', message: '',
}

const stagger = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { staggerChildren: 0.07 } },
}

const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

export function LeadForm() {
    const [form, setForm] = useState<RawLeadFormData>(EMPTY)
    const [errors, setErrors] = useState<Partial<RawLeadFormData>>({})
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [apiError, setApiError] = useState<string | null>(null)

    const set = (field: keyof RawLeadFormData) => (value: string) =>
        setForm(prev => ({ ...prev, [field]: value }))

    function validate(): boolean {
        const e: Partial<RawLeadFormData> = {}
        if (!form.name.trim()) e.name = 'Required'
        if (!form.email.trim()) e.email = 'Required'
        if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
        if (!form.company.trim()) e.company = 'Required'
        if (!form.budget) e.budget = 'Required'
        if (!form.timeline) e.timeline = 'Required'
        if (!form.message.trim()) e.message = 'Required'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setApiError(null)
        if (!validate()) return

        setLoading(true)
        try {
            const res = await fetch('/api/qualify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data: QualifyApiResponse = await res.json()

            if (!data.success) throw new Error(data.error)
            setSuccess(true)
        } catch (err) {
            setApiError(err instanceof Error ? err.message : 'Something went wrong.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence mode="wait">
            {success ? (
                <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-6 py-8"
                >
                    <div className="w-8 h-px bg-[#C8102E]" />
                    <p className="font-[family-name:var(--font-serif)] text-2xl font-light text-[#F0EBE1]">
                        We&apos;ll be in touch.
                    </p>
                    <p className="font-[family-name:var(--font-sans)] text-sm font-light text-[#555] leading-relaxed max-w-sm">
                        Your inquiry has been received and qualified. Expect a tailored
                        response in your inbox shortly.
                    </p>
                </motion.div>
            ) : (
                <motion.form
                    key="form"
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-8"
                    noValidate
                >
                    {/* Row 1 — Name + Email */}
                    <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField label="Full Name" name="name" value={form.name} onChange={set('name')} error={errors.name} required placeholder="Jane Smith" />
                        <FormField label="Email Address" name="email" type="email" value={form.email} onChange={set('email')} error={errors.email} required placeholder="jane@company.com" />
                    </motion.div>

                    {/* Row 2 — Company */}
                    <motion.div variants={fadeUp}>
                        <FormField label="Company / Organisation" name="company" value={form.company} onChange={set('company')} error={errors.company} required placeholder="Acme Inc." />
                    </motion.div>

                    {/* Row 3 — Budget + Timeline */}
                    <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField label="Budget Range" name="budget" type="select" options={BUDGET_OPTIONS} value={form.budget} onChange={set('budget')} error={errors.budget} required />
                        <FormField label="Timeline" name="timeline" type="select" options={TIMELINE_OPTIONS} value={form.timeline} onChange={set('timeline')} error={errors.timeline} required />
                    </motion.div>

                    {/* Row 4 — Message */}
                    <motion.div variants={fadeUp}>
                        <FormField
                            label="Project Brief"
                            name="message"
                            type="textarea"
                            value={form.message}
                            onChange={set('message')}
                            error={errors.message}
                            required
                            placeholder="Describe what you're building, what problem you're solving, and what success looks like."
                        />
                    </motion.div>

                    {/* API Error */}
                    <AnimatePresence>
                        {apiError && (
                            <motion.p
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="font-[family-name:var(--font-data)] text-[10px] 
                  tracking-widest text-[#C8102E]"
                            >
                                {apiError}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    <motion.div variants={fadeUp}>
                        <SubmitButton loading={loading} success={success} />
                    </motion.div>
                </motion.form>
            )}
        </AnimatePresence>
    )
}