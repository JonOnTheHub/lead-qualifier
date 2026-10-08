import { createAdminClient } from '@/lib/supabase/server'
import StatsStrip from '@/components/admin/StatsStrip'
import QueueControls from '@/components/admin/QueueControls'
import LeadsTable from '@/components/admin/LeadsTable'
import { Lead } from '@/types/lead'
import type { FieldMap } from '@/types/tenant'

// Always fetch fresh — never serve cached lead data from edge
export const dynamic = 'force-dynamic'

// Server actions called from this page (Retry, Process queue) run the AI
// analysis, which takes several seconds per lead. They inherit this limit.
export const maxDuration = 60

export default async function AdminPage() {
    const supabase = createAdminClient()

    const [leadsRes, tenantsRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, field_map'),
    ])

    const { data: leads, error } = leadsRes

    if (error) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <p className="font-data text-[10px] tracking-widest text-accent uppercase">
                    Error loading leads
                </p>
            </div>
        )
    }

    const all = leads as Lead[]

    // tenant_id -> field map, so the drawer can label each lead's fields.
    // If this lookup fails, the drawer falls back to prettified keys.
    const fieldMaps: Record<string, FieldMap> = Object.fromEntries(
        (tenantsRes.data ?? []).map(t => [t.id, t.field_map as FieldMap]),
    )

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
            <StatsStrip leads={all} />

            {/* Appears only when something is queued, analyzing or failed */}
            <QueueControls
                waiting={all.filter(l => l.status === 'queued').length}
                analyzing={all.filter(l => l.status === 'processing').length}
                failed={all.filter(l => l.status === 'failed').length}
            />

            {/* Table */}
            <div className="mt-6">
                <LeadsTable leads={all} fieldMaps={fieldMaps} />
            </div>

        </main>
    )
}