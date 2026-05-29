import { LeadForm } from '@/components/lead-form/LeadForm'
import { StatusDot } from '@/components/ui/StatusDot'

export default function Home() {
  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2">

      {/* LEFT — Brand panel */}
      <div className="relative flex flex-col justify-between p-12 lg:p-16 
        border-r border-surface-2 bg-background">

        {/* Vertical rule accent */}
        <div className="absolute top-0 right-0 bottom-0 w-px bg-linear-to-b 
          from-transparent via-[#C8102E]/20 to-transparent" />

        {/* Top — wordmark */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <StatusDot />
            <span className="font-data text-[10px] 
              tracking-[0.3em] text-[#555] uppercase">
              Accepting Inquiries
            </span>
          </div>
        </div>

        {/* Middle — headline */}
        <div className="flex flex-col gap-6">
          <div className="w-8 h-px bg-[#C8102E]" />
          <h1 className="font-serif font-light 
            text-5xl lg:text-6xl leading-[1.1] text-[#F0EBE1] tracking-tight">
            Tell us what<br />
            you&apos;re building.
          </h1>
          <p className="font-sans font-light text-sm 
            text-[#555] leading-relaxed max-w-sm">
            Every inquiry is reviewed, qualified, and responded to with a
            brief tailored to your project. No templates. No delays.
          </p>
        </div>

        {/* Bottom — meta */}
        <div className="flex flex-col gap-2">
          <span className="font-data text-[10px] 
            tracking-[0.2em] text-[#333] uppercase">
            Response within 24h
          </span>
          <span className="font-data text-[10px] 
            tracking-[0.2em] text-[#333] uppercase">
            All inquiries are confidential
          </span>
        </div>
      </div>

      {/* RIGHT — Form panel */}
      <div className="flex flex-col justify-center p-12 lg:p-16 bg-background">
        <div className="max-w-md w-full mx-auto lg:mx-0">

          {/* Section header */}
          <div className="mb-10 flex flex-col gap-3">
            <span className="font-data text-[10px] 
              tracking-[0.3em] text-[#555] uppercase">
              Project Inquiry
            </span>
            <div className="w-8 h-px bg-[#222]" />
          </div>

          <LeadForm />
        </div>
      </div>
    </main>
  )
}