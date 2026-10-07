import { createAdminClient } from '@/lib/supabase/server'
import type { Tenant } from '@/types/tenant'

// Defaults suit the free AI tier, which is shared across every tenant.
// Override per tenant in tenants.settings, e.g. {"rate_per_minute": 60, "daily_cap": 300}.
const DEFAULT_PER_MINUTE = 20
const DEFAULT_PER_DAY = 60

export interface LimitResult {
    allowed: boolean
    retryAfterSeconds?: number
    reason?: 'minute' | 'day'
}

function setting(tenant: Tenant, key: string, fallback: number): number {
    const value = Number(tenant.settings?.[key])
    return Number.isFinite(value) && value > 0 ? value : fallback
}

// Counts this request against the tenant's current minute and day, using the
// bump_rate_limit database function (one atomic increment per bucket). The old
// in-memory limiter kept a separate counter per serverless instance, so it could
// not enforce anything real. This one can.
//
// Fails open: if the counter itself errors, the lead is accepted. Losing a real
// lead to a bookkeeping error is worse than a brief gap in rate limiting.
export async function checkTenantLimits(tenant: Tenant): Promise<LimitResult> {
    const perMinute = setting(tenant, 'rate_per_minute', DEFAULT_PER_MINUTE)
    const perDay = setting(tenant, 'daily_cap', DEFAULT_PER_DAY)

    const now = new Date()
    const minuteBucket = `m:${now.toISOString().slice(0, 16)}`
    const dayBucket = `d:${now.toISOString().slice(0, 10)}`

    const supabase = createAdminClient()
    const [minute, day] = await Promise.all([
        supabase.rpc('bump_rate_limit', { p_tenant: tenant.id, p_bucket: minuteBucket }),
        supabase.rpc('bump_rate_limit', { p_tenant: tenant.id, p_bucket: dayBucket }),
    ])

    if (minute.error || day.error) {
        console.error('[limits] counter failed, allowing request:', minute.error ?? day.error)
        return { allowed: true }
    }

    if ((day.data as number) > perDay) {
        const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
        return {
            allowed: false,
            reason: 'day',
            retryAfterSeconds: Math.max(1, Math.ceil((midnight - now.getTime()) / 1000)),
        }
    }

    if ((minute.data as number) > perMinute) {
        return {
            allowed: false,
            reason: 'minute',
            retryAfterSeconds: Math.max(1, 60 - now.getUTCSeconds()),
        }
    }

    return { allowed: true }
}