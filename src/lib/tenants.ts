import { createAdminClient } from '@/lib/supabase/server'
import type { Tenant } from '@/types/tenant'

// Tenant rows hold webhook keys and Slack URLs, so this only ever runs
// server-side through the service-role client (RLS has no public policy).

async function fetchOne(column: 'id' | 'slug' | 'webhook_key', value: string) {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq(column, value)
        .maybeSingle()

    if (error) throw new Error(`Tenant lookup failed: ${error.message}`)
    return data as Tenant | null
}

export const getTenantBySlug = (slug: string) => fetchOne('slug', slug)

// Used by the approve action to get the sender identity for a lead.
export const getTenantById = (id: string) => fetchOne('id', id)

// Used by the webhook receiver in the next phase.
export const getTenantByWebhookKey = (key: string) => fetchOne('webhook_key', key)