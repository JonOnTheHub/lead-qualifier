import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notifySlack } from '@/lib/slack'
import { checkRateLimit } from '@/lib/ratelimit'
import { getTenantBySlug } from '@/lib/tenants'
import { runPipeline, extractContact, type Payload } from '@/lib/pipeline'
import { MODEL } from '@/lib/groq'

// This route serves the Better Call Jon demo form. The webhook route
// (next phase) will serve every other tenant, keyed by webhook_key.
const DEMO_TENANT_SLUG = 'better-call-jon'

const MAX_BODY_BYTES = 50_000

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = checkRateLimit(ip)

    if (!allowed) {
        return NextResponse.json(
            { success: false, error: 'Too many requests. Please wait a moment.' },
            { status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
        )
    }

    try {
        // Read as text first so oversized bodies get rejected before parsing.
        const raw = await req.text()
        if (raw.length > MAX_BODY_BYTES) {
            return NextResponse.json(
                { success: false, error: 'Submission too large' },
                { status: 413 },
            )
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch {
            return NextResponse.json(
                { success: false, error: 'Invalid JSON' },
                { status: 400 },
            )
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return NextResponse.json(
                { success: false, error: 'Invalid submission' },
                { status: 400 },
            )
        }
        const body = parsed as Payload

        const tenant = await getTenantBySlug(DEMO_TENANT_SLUG)
        if (!tenant || !tenant.active) {
            return NextResponse.json(
                { success: false, error: 'Intake is unavailable right now.' },
                { status: 503 },
            )
        }

        const contact = extractContact(tenant, body)
        if (!contact.name || !contact.email || !contact.message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 },
            )
        }

        // ── ENGINE ──
        const result = await runPipeline(tenant, body)

        // ── STORE AS PENDING REVIEW ──
        // The draft is saved but NOT sent. A human approves from the admin
        // drawer, and the approve action is what actually sends the email.
        // The legacy company/budget/timeline columns are still filled for
        // this tenant. `fields` holds the full raw submission.
        const text = (key: string) =>
            typeof body[key] === 'string' ? (body[key] as string) : ''

        const supabase = createAdminClient()

        const { data: lead, error: dbError } = await supabase
            .from('leads')
            .insert({
                tenant_id: tenant.id,
                fields: body,
                name: contact.name,
                email: contact.email,
                message: contact.message,
                company: text('company'),
                budget: text('budget'),
                timeline: text('timeline'),
                ...result.ai,
                email_sent: false,
                slack_notified: false,
                status: 'pending_review',
            })
            .select()
            .single()

        if (dbError) throw new Error(`Supabase insert failed: ${dbError.message}`)

        // Slack is a heads-up only. If it fails, the lead is still
        // safely in the queue, so we swallow the error.
        const company = text('company')
        let slackNotified = false
        try {
            await notifySlack({
                name: contact.name,
                company: company.length > 40 ? `${company.slice(0, 40)}...` : company,
                classification: result.ai.classification,
                urgency_score: result.ai.urgency_score,
                intent: result.ai.intent,
                lead_id: lead.id,
            })
            slackNotified = true
        } catch (err) {
            console.warn('[qualify] slack failed:', err)
        }

        if (slackNotified) {
            await supabase
                .from('leads')
                .update({ slack_notified: true })
                .eq('id', lead.id)
        }

        await supabase.from('usage_logs').insert([
            {
                lead_id: lead.id,
                model: MODEL,
                ...result.turn1.usage,
                turn: 1,
                latency_ms: result.turn1.latencyMs,
            },
            {
                lead_id: lead.id,
                model: MODEL,
                ...result.turn2.usage,
                turn: 2,
                latency_ms: result.turn2.latencyMs,
            },
        ])

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            results: result.ai,
        })
    } catch (error) {
        console.error('[qualify] error:', error)
        return NextResponse.json(
            { success: false, error: 'Intake submission failed. Please try again.' },
            { status: 500 },
        )
    }
}