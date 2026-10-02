export type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified'

export type LeadSentiment = 'positive' | 'neutral' | 'negative' | 'urgent'

// Review state machine. 'sending' is a claim state: whoever flips
// pending_review -> sending owns the send, so double clicks can't double send.
export type LeadStatus =
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

export interface Lead extends RawLeadFormData, AIToolResults {
    id: string
    created_at: string
    email_sent: boolean
    slack_notified: boolean
    status: LeadStatus
    reviewed_at: string | null
    send_error: string | null
    // Null only for rows written before the pipeline started setting it
    // (the migration backfills those). `fields` is the raw submission as posted.
    tenant_id: string | null
    fields: Record<string, unknown>
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