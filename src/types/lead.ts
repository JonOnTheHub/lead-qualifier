export type LeadClassification = 'hot' | 'warm' | 'cold' | 'unqualified'

export type LeadSentiment = 'positive' | 'neutral' | 'negative' | 'urgent'

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
}

export interface QualifyApiResponse {
    success: boolean
    lead_id?: string
    results?: AIToolResults
    error?: string
}