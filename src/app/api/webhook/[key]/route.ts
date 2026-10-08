import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getTenantByWebhookKey } from '@/lib/tenants'
import { extractContact } from '@/lib/pipeline'
import { checkTenantLimits } from '@/lib/tenant-limits'
import { parseBody, flatten, makeDedupeKey } from '@/lib/webhook-payload'
import { drainQueue } from '@/lib/process-lead'

// `after` keeps running once the 202 has gone out, and it is bound by this
// limit. 60s is the longest a Hobby function is allowed to run.
export const maxDuration = 60

const MAX_BODY_CHARS = 50_000
const KEY_PATTERN = /^[a-f0-9]{32}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (body: unknown, status: number, headers?: Record<string, string>) =>
    NextResponse.json(body, { status, headers })

// POST /api/webhook/<webhook_key>
//
// Queue-first: this route only saves the submission and answers. The slow part
// (the AI analysis) runs afterwards, so the sender gets a fast 202, a failing
// or rate-limited AI call can never lose a lead, and a retry from the sender is
// recognized instead of creating a duplicate.
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ key: string }> },
) {
    const { key } = await params

    // 1. WHO IS THIS FOR
    // The key in the URL is the credential. A malformed key never touches the
    // database, and unknown or paused tenants get the same plain 404, so the
    // response reveals nothing about which keys exist.
    if (!KEY_PATTERN.test(key)) return json({ error: 'Not found' }, 404)

    let tenant
    try {
        tenant = await getTenantByWebhookKey(key)
    } catch (err) {
        console.error('[webhook] tenant lookup failed:', err)
        return json({ error: 'Temporarily unavailable' }, 503)
    }
    if (!tenant || !tenant.active) return json({ error: 'Not found' }, 404)

    // 2. PER-TENANT LIMITS
    const limit = await checkTenantLimits(tenant)
    if (!limit.allowed) {
        return json(
            { error: limit.reason === 'day' ? 'Daily limit reached' : 'Too many requests' },
            429,
            { 'Retry-After': String(limit.retryAfterSeconds ?? 60) },
        )
    }

    // 3. THE BODY
    // Read as text first so an oversized body is rejected before any parsing.
    const raw = await req.text()
    if (raw.length > MAX_BODY_CHARS) return json({ error: 'Payload too large' }, 413)

    const parsed = parseBody(raw, req.headers.get('content-type') ?? '')
    if (!parsed) {
        return json({ error: 'Send a JSON object or form-encoded fields' }, 400)
    }
    const payload = flatten(parsed)

    // 4. WHO SENT IT
    // We need an email to reply to. If the tenant's field mapping can't find
    // one, say exactly what we looked for and what we received, so a setup
    // mistake is obvious instead of silently dropping leads.
    const contact = extractContact(tenant, payload)
    if (!EMAIL_PATTERN.test(contact.email)) {
        return json(
            {
                error: 'No valid email address found in this submission',
                looked_for: tenant.field_map.identity?.email ?? 'email',
                received_fields: Object.keys(payload).slice(0, 40),
            },
            422,
        )
    }

    // 5. SAVE IT FIRST
    // From this insert onward the lead is safe, whatever happens to the AI step.
    // Optional: the tenant can name a field that carries the platform's own
    // submission id (settings.dedupe_field), which then decides duplicates.
    const dedupeField =
        typeof tenant.settings?.dedupe_field === 'string' ? tenant.settings.dedupe_field : null
    const fieldValue = dedupeField ? String(payload[dedupeField] ?? '') : null
    const dedupeKey = makeDedupeKey(raw, req.headers.get('idempotency-key'), fieldValue)
    const supabase = createAdminClient()

    const { data: lead, error } = await supabase
        .from('leads')
        .insert({
            tenant_id: tenant.id,
            fields: payload,
            name: contact.name,
            email: contact.email,
            message: contact.message,
            status: 'queued',
            dedupe_key: dedupeKey,
        })
        .select('id')
        .single()

    if (error) {
        // 23505 = unique violation: the same submission already arrived.
        // Answer success with the original lead, so the sender stops retrying.
        if (error.code === '23505') {
            const { data: existing } = await supabase
                .from('leads')
                .select('id')
                .eq('tenant_id', tenant.id)
                .eq('dedupe_key', dedupeKey)
                .maybeSingle()
            return json({ ok: true, duplicate: true, id: existing?.id ?? null }, 200)
        }
        console.error('[webhook] insert failed:', error.message)
        return json({ error: 'Could not save the submission' }, 500)
    }

    // 6. ANALYZE AFTER THE RESPONSE
    after(() => drainQueue())

    return json({ ok: true, id: lead.id, status: 'queued' }, 202)
}