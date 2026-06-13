'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Typewriter } from '@/components/ui/Typewriter'
import { LeadForm } from '@/components/lead-form/LeadForm'

export default function Home() {
  const [subVisible, setSubVisible] = useState(false)
  const [formVisible, setFormVisible] = useState(false)

  function handleTypewriterComplete() {
    setSubVisible(true)
    setTimeout(() => setFormVisible(true), 400)
  }

  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2">

      {/* LEFT — Firm panel */}
      <div className="relative flex flex-col justify-between
        px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16
        border-b lg:border-b-0 lg:border-r border-border bg-background">

        {/* Accent line — top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />

        <div>
          <span className="font-data text-[10px] tracking-[0.3em] text-text-dim uppercase">
            Confidential Intake Portal
          </span>
        </div>

        <div className="flex flex-col gap-6 mt-8 lg:mt-0">
          <div className="w-8 h-0.5 bg-accent" />
          <h1 className="font-serif
            text-4xl sm:text-5xl lg:text-5xl
            leading-[1.15] text-text tracking-tight">
            <Typewriter
              lines={['Better Call Jon.']}
              speed={60}
              onComplete={handleTypewriterComplete}
            />
          </h1>

          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0, y: 6 }}
            animate={subVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="font-sans font-normal text-sm
              text-text-muted leading-relaxed max-w-sm">
              Personal injury representation for people who deserve to be heard.
              Complete the intake form and our team will review your case
              within 24 hours.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {[
                'No fees unless we win',
                'Free confidential consultation',
                'Available in English and Spanish',
              ].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-accent shrink-0" />
                  <span className="font-sans text-xs text-text-muted">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="hidden lg:flex flex-col gap-2 mt-16">
          <span className="font-data text-[10px] tracking-[0.2em] text-text-dim uppercase">
            All submissions are confidential
          </span>
          <span className="font-data text-[10px] tracking-[0.2em] text-text-dim uppercase">
            This form does not constitute legal advice
          </span>
        </div>
      </div>

      {/* RIGHT — Intake form */}
      <div className="flex flex-col justify-center
        px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16
        bg-[#0d1628]">
        <div className="max-w-md w-full mx-auto lg:mx-0">

          <div className="mb-10 flex flex-col gap-3">
            <span className="font-data text-[10px] tracking-[0.3em] text-text-dim uppercase">
              Case Intake Form
            </span>
            <div className="w-8 h-0.5 bg-border" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={formVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <LeadForm />
          </motion.div>

        </div>
      </div>

    </main>
  )
}