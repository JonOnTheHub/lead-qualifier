import { createAdminClient } from '@/lib/supabase/server'
import { getTenantById } from '@/lib/tenants'
import { runPipeline, type Payload } from '@/lib/pipeline'
import { notifySlack } from '@/lib/slack'
import { MODEL } from '@/lib/groq'
import type { Lead } from '@/types/lead'

// ─────────────────────────────────────────────
// THE QUEUE WORKER
// The webhook only saves a lead (status 'queued') and answers. This file does
// the slow part: analyze it, store the result, tell Slack.
//
// Any number of workers can run at once (each webhook request starts one), but
// the claim_next_lead database function caps how many leads are analyzed at the
// same time, so a burst of submissions can't become a burst of AI requests.
// ─────────────────────────────────────────────

const MAX_CONCURRENT = 2       // leads analyzed at once, across all instances
const STALE_MS = 5 * 60_000    // 'processing' longer than this = worker died, reclaim it
const MAX_ATTEMPTS = 3         // after this many failed tries the lead is marked failed
const RATE_LIMIT_PAUSE_MS = 15_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function isRateLimited(err: unknown): boolean {
    return (err as { status?: number } | null)?.status === 429 || /429|rate limit/i.test(String(err))
}

async function claimNext(): Promise<Lead | null> {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('claim_next_lead', {
        p_max: MAX_CONCURRENT,
        p_stale: new Date(Date.now() - STALE_MS).toISOString(),
    })
    if (error) {
        console.error('[queue] claim failed:', error.message)
        return null
    }
    return ((data as Lead[] | null)?.[0]) ?? null
}

// Never throws: a failure becomes a status on the lead, not a crashed worker.
async function analyzeLead(lead: Lead): Promise<void> {
    const supabase = createAdminClient()
    const attempt = lead.attempts + 1

    let result
    try {
        const tenant = await getTenantById(lead.tenant_id)
        if (!tenant) throw new Error('Tenant not found for this lead')

        result = await runPipeline(tenant, lead.fields as Payload)

        // The status guard means a worker that was reclaimed as "stale" can't
        // overwrite a result another worker already saved.
        const { error } = await supabase
            .from('leads')
            .update({
                ...result.ai,
                status: 'pending_review',
                attempts: attempt,
                last_error: null,
                processing_started_at: null,
            })
            .eq('id', lead.id)
            .eq('status', 'processing')

        if (error) throw new Error(`Saving the analysis failed: ${error.message}`)
    } catch (err) {
        const message = (err instanceof Error ? err.message : String(err)).slice(0, 500)
        console.warn(`[queue] lead ${lead.id} attempt ${attempt} failed:`, message)

        // Back into the queue for another try, until the attempts run out.
        await supabase
            .from('leads')
            .update({
                status: attempt >= MAX_ATTEMPTS ? 'failed' : 'queued',
                attempts: attempt,
                last_error: message,
                processing_started_at: null,
            })
            .eq('id', lead.id)
            .eq('status', 'processing')

        // Rate limits are per minute, so retrying instantly would just hit the
        // same wall. Breathe first.
        if (isRateLimited(err)) await sleep(RATE_LIMIT_PAUSE_MS)
        return
    }

    // The analysis is saved. Slack and usage logs are extras: if they fail, the
    // lead must NOT go back in the queue, so they live outside the try above.
    try {
        const tenant = await getTenantById(lead.tenant_id)
        const sent = await notifySlack(
            {
                name: lead.name,
                context: lead.company,
                classification: result.ai.classification,
                urgency_score: result.ai.urgency_score,
                intent: result.ai.intent,
                lead_id: lead.id,
                tenantName: tenant?.name ?? '',
            },
            tenant?.slack_webhook_url,
        )
        if (sent) await supabase.from('leads').update({ slack_notified: true }).eq('id', lead.id)
    } catch (err) {
        console.warn('[queue] slack failed:', err)
    }

    const { error: usageError } = await supabase.from('usage_logs').insert([
        { lead_id: lead.id, model: MODEL, ...result.turn1.usage, turn: 1, latency_ms: result.turn1.latencyMs },
        { lead_id: lead.id, model: MODEL, ...result.turn2.usage, turn: 2, latency_ms: result.turn2.latencyMs },
    ])
    if (usageError) console.warn('[queue] usage log failed:', usageError.message)
}

// Works through the queue until it is empty or the time budget runs out.
// The budget sits well under the route's 60s maxDuration so the last lead has
// room to finish. If a worker is cut off anyway, the lead is reclaimed as stale.
export async function drainQueue(budgetMs = 35_000): Promise<void> {
    const deadline = Date.now() + budgetMs
    while (Date.now() < deadline) {
        const lead = await claimNext()
        if (!lead) return
        await analyzeLead(lead)
    }
}