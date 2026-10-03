'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { isAdmin } from '@/lib/admin-auth'
import { getTenantById } from '@/lib/tenants'

type ActionResult = { ok: true } | { ok: false; error: string }

// States a human is allowed to act on. send_failed is included so
// a failed send can be retried straight from the drawer.
const REVIEWABLE = ['pending_review', 'send_failed']

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