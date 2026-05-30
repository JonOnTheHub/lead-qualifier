import { LeadForm } from '@/components/lead-form/LeadForm'

export default function Home() {
  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2">

      {/* LEFT — Brand panel */}
      <div className="relative flex flex-col justify-between
        px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16
        border-b lg:border-b-0 lg:border-r border-surface-2 bg-background">

        <div className="absolute top-0 right-0 bottom-0 w-px bg-linear-to-b
          from-transparent via-[#C8102E]/20 to-transparent hidden lg:block" />

        {/* Top — wordmark */}
        <div>
          <span className="font-data text-[10px] tracking-[0.3em] text-[#555] uppercase">
            Accepting Inquiries
          </span>
        </div>

        {/* Middle — headline */}
        <div className="flex flex-col gap-5 mt-8 lg:mt-0">
          <div className="w-8 h-px bg-[#C8102E]" />
          <h1 className="font-serif font-light
            text-4xl sm:text-5xl lg:text-6xl
            leading-[1.1] text-[#F0EBE1] tracking-tight">
            Tell us what<br />
            you&apos;re building.
          </h1>
          <p className="font-sans font-light text-sm
            text-[#555] leading-relaxed max-w-sm">
            Every inquiry is reviewed, qualified, and responded to with a
            brief tailored to your project. No templates. No delays.
          </p>
        </div>

        {/* Bottom meta — hidden on mobile, not worth the space */}
        <div className="hidden lg:flex flex-col gap-2 mt-16">
          <span className="font-data text-[10px] tracking-[0.2em] text-[#333] uppercase">
            Response within 24h
          </span>
          <span className="font-data text-[10px] tracking-[0.2em] text-[#333] uppercase">
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
            <span className="font-data text-[10px] tracking-[0.3em] text-[#555] uppercase">
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