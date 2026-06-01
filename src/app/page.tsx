'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Typewriter } from '@/components/ui/Typewriter'
import { LeadForm } from '@/components/lead-form/LeadForm'

export default function Home() {
  const [subVisible, setSubVisible] = useState(false)
  const [formVisible, setFormVisible] = useState(false)

  // Typewriter finishes → subheading fades in → 400ms later form reveals
  function handleTypewriterComplete() {
    setSubVisible(true)
    setTimeout(() => setFormVisible(true), 400)
  }

  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2">

      {/* LEFT — Brand panel */}
      <div className="relative flex flex-col justify-between
        px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16
        border-b lg:border-b-0 lg:border-r border-surface-2 bg-background">

        <div className="absolute top-0 right-0 bottom-0 w-px bg-linear-to-b
          from-transparent via-[#C8102E]/20 to-transparent hidden lg:block" />

        <div>
          <span className="font-data text-[10px] tracking-[0.3em] text-[#888] uppercase">
            Accepting Inquiries
          </span>
        </div>

        <div className="flex flex-col gap-5 mt-8 lg:mt-0">
          <div className="w-8 h-px bg-[#C8102E]" />

          {/* Typewriter headline */}
          <h1 className="font-serif font-normal
            text-4xl sm:text-5xl lg:text-6xl
            leading-[1.1] text-[#F0EBE1] tracking-tight">
            <Typewriter
              lines={['Tell us what', "you're building."]}
              speed={35}
              onComplete={handleTypewriterComplete}
            />
          </h1>

          {/* Subheading — fades in after typewriter */}
          <motion.p
            className="font-sans font-normal text-sm text-[#888] leading-relaxed max-w-sm"
            initial={{ opacity: 0, y: 6 }}
            animate={subVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            Every inquiry is reviewed, qualified, and responded to with a
            brief tailored to your project. No templates. No delays.
          </motion.p>
        </div>

        <div className="hidden lg:flex flex-col gap-2 mt-16">
          <span className="font-data text-[10px] tracking-[0.2em] text-[#555] uppercase">
            Response within 24h
          </span>
          <span className="font-data text-[10px] tracking-[0.2em] text-[#555] uppercase">
            All inquiries are confidential
          </span>
        </div>
      </div>

      {/* RIGHT — Form panel */}
      <div className="flex flex-col justify-center
        px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16
        bg-background">
        <div className="max-w-md w-full mx-auto lg:mx-0">

          <div className="mb-10 flex flex-col gap-3">
            <span className="font-data text-[10px] tracking-[0.3em] text-[#888] uppercase">
              Project Inquiry
            </span>
            <div className="w-8 h-px bg-[#444]" />
          </div>

          {/* Form mounts after subheading — avoids it fighting for attention */}
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