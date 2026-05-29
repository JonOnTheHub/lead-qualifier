import { createAdminClient } from '@/lib/supabase/server'
import StatsStrip from '@/components/admin/StatsStrip'
import LeadsTable from '@/components/admin/LeadsTable'
import { Lead } from '@/types/lead'

// Always fetch fresh — never serve cached lead data from edge
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
    const supabase = createAdminClient()

    const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <p className="font-data text-[10px] tracking-widest text-accent uppercase">
                    Error loading leads
                </p>
            </div>
        )
    }

    return (
        <main className="min-h-dvh bg-background">

            {/* Top bar */}
            <div className="border-b border-line px-8 py-5 flex items-center justify-between">
                <div className="absolute top-0 left-0 right-0 h-px bg-accent" />
                <span className="font-data text-[10px] tracking-[0.25em] text-ghost uppercase">
                    Lead Qualifier // Admin
                </span>
                <span className="font-data text-[9px] tracking-wider text-ghost">
                    {new Date().toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                </span>
            </div>

            {/* Stats */}
            <StatsStrip leads={leads as Lead[]} />

            {/* Table */}
            <LeadsTable leads={leads as Lead[]} />

        </main>
    )
}