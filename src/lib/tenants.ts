import { createAdminClient } from '@/lib/supabase/server'
import type { Tenant } from '@/types/tenant'

// Tenant rows hold webhook keys and Slack URLs, so this only ever runs
// server-side through the service-role client (RLS has no public policy).

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

    if (error) throw new Error(`Tenant lookup failed: ${error.message}`)
    return data as Tenant | null
}

// Used by the webhook receiver in the next phase.
export async function getTenantByWebhookKey(key: string): Promise<Tenant | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('webhook_key', key)
        .maybeSingle()

    if (error) throw new Error(`Tenant lookup failed: ${error.message}`)
    return data as Tenant | null
}