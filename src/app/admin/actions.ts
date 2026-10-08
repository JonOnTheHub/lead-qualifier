'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { isAdmin } from '@/lib/admin-auth'
import { getTenantById } from '@/lib/tenants'
import { drainQueue } from '@/lib/process-lead'

type ActionResult = { ok: true } | { ok: false; error: string }

// States a human is allowed to act on. send_failed is included so
// a failed send can be retried straight from the drawer.
const REVIEWABLE = ['pending_review', 'send_failed']

// How long an admin click waits for analysis. Admin page allows 60s (see
// maxDuration there), and the last lead needs room to finish after this.
const QUEUE_BUDGET_MS = 25_000

export async function approveLead(
    id: string,
    subject: string,
    body: string,
): Promise<ActionResult> {
    if (!(await isAdmin())) return { ok: false, error: 'Unauthorized' }

    const cleanSubject = subject.trim()
    const cleanBody = body.trim()
    if (!cleanSubject || !cleanBody) {
        return { ok: false, error: 'Subject and body cannot be empty' }
    }

    const supabase = createAdminClient()

    // Load the sender identity BEFORE claiming. If this lookup fails, we
    // return without touching the lead. Doing it after the claim could
    // strand the lead in 'sending'.
    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('tenant_id')
        .eq('id', id)
        .maybeSingle()

    if (leadError) return { ok: false, error: leadError.message }
    if (!lead) return { ok: false, error: 'Lead not found' }

    let tenant
    try {
        tenant = await getTenantById(lead.tenant_id)
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Tenant lookup failed' }
    }
    if (!tenant) return { ok: false, error: 'Tenant not found for this lead' }

    // CLAIM: flip to 'sending' only if the lead is still reviewable.
    // Postgres runs this atomically, so if two clicks race, exactly one
    // gets a row back. The loser sees null and bails without sending.
    // We also save the reviewer's edits here, so what's stored is
    // exactly what goes out.
    const { data: claimed, error: claimError } = await supabase
        .from('leads')
        .update({
            status: 'sending',
            email_subject: cleanSubject,
            email_body: cleanBody,
            send_error: null,
        })
        .eq('id', id)
        .in('status', REVIEWABLE)
        .select('email')
        .maybeSingle()

    if (claimError) return { ok: false, error: claimError.message }
    if (!claimed) return { ok: false, error: 'Lead was already handled' }

    try {
        await sendEmail({
            to: claimed.email,
            subject: cleanSubject,
            body: cleanBody,
            firmName: tenant.name,
            replyTo: tenant.reply_to_email,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown send error'
        await supabase
            .from('leads')
            .update({ status: 'send_failed', send_error: message })
            .eq('id', id)
        revalidatePath('/admin')
        return { ok: false, error: `Send failed: ${message}` }
    }

    const { error: doneError } = await supabase
        .from('leads')
        .update({
            status: 'sent',
            email_sent: true,
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)

    // The email already went out. Don't tell the reviewer it failed
    // just because bookkeeping did. Log it and move on.
    if (doneError) console.error('[approve] sent but status update failed:', doneError)

    revalidatePath('/admin')
    return { ok: true }
}

export async function rejectLead(id: string): Promise<ActionResult> {
    if (!(await isAdmin())) return { ok: false, error: 'Unauthorized' }

    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('leads')
        .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
        .eq('id', id)
        .in('status', REVIEWABLE)
        .select('id')
        .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'Lead was already handled' }

    revalidatePath('/admin')
    return { ok: true }
}

// Puts a failed (or waiting) lead back at the front of the line, with a fresh
// set of attempts, then runs the queue so the result shows up right away.
export async function retryLead(id: string): Promise<ActionResult> {
    if (!(await isAdmin())) return { ok: false, error: 'Unauthorized' }

    const supabase = createAdminClient()

    const { data, error } = await supabase
        .from('leads')
        .update({
            status: 'queued',
            attempts: 0,
            last_error: null,
            processing_started_at: null,
        })
        .eq('id', id)
        .in('status', ['failed', 'queued'])
        .select('id')
        .maybeSingle()

    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: 'This lead is not waiting for analysis' }

    await drainQueue(QUEUE_BUDGET_MS)

    revalidatePath('/admin')
    return { ok: true }
}

// Works through everything waiting in the queue. Also picks up any lead that
// has been stuck in 'processing' for over 5 minutes (a worker that died).
export async function processQueue(): Promise<ActionResult> {
    if (!(await isAdmin())) return { ok: false, error: 'Unauthorized' }

    await drainQueue(QUEUE_BUDGET_MS)

    revalidatePath('/admin')
    return { ok: true }
}