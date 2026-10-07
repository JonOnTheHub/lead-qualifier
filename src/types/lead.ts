export type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified'

export type LeadSentiment = 'positive' | 'neutral' | 'negative' | 'urgent'

// Lifecycle of a lead.
//   Intake side (webhook, queue-first):
//     queued      saved the moment it arrived, not analyzed yet
//     processing  being analyzed right now (claimed by one worker)
//     failed      analysis failed; the lead is safe and can be retried
//   Review side:
//     pending_review -> sending -> sent, or rejected / send_failed
// 'sending' is a claim state: whoever flips pending_review -> sending owns the
// send, so double clicks can't double send. 'processing' works the same way
// for analysis.
export type LeadStatus =
    | 'queued'
    | 'processing'
    | 'failed'
    | 'pending_review'
    | 'sending'
    | 'sent'
    | 'rejected'
    | 'send_failed'

export interface RawLeadFormData {
    name: string
    email: string
    company: string
    budget: string
    timeline: string
    message: string
}

export interface AIToolResults {
    classification: LeadClassification
    confidence: number
    reasoning: string
    intent: string
    needs: string[]
    sentiment: LeadSentiment
    urgency_score: number // 1-10
    tone_notes: string
    email_subject: string
    email_body: string
}

type Nullable<T> = { [K in keyof T]: T[K] | null }

// A stored lead. The AI fields are null until analysis finishes, which is
// the normal state for queued, processing and failed leads.
export interface Lead extends RawLeadFormData, Nullable<AIToolResults> {
    id: string
    created_at: string
    email_sent: boolean
    slack_notified: boolean
    status: LeadStatus
    reviewed_at: string | null
    send_error: string | null
    tenant_id: string
    // The raw submission as posted, keyed by the sender's field names.
    fields: Record<string, unknown>
    // Analysis bookkeeping for the queue.
    attempts: number
    last_error: string | null
    processing_started_at: string | null
    dedupe_key: string | null
}

export interface QualifyApiResponse {
    success: boolean
    lead_id?: string
    results?: AIToolResults
    error?: string
}

export interface UsageLog {
    id: string
    created_at: string
    lead_id: string
    model: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    turn: number
    latency_ms: number
}