// How a tenant's payloads map onto the pipeline and the admin.
//   identity:     which payload keys hold the lead's name, email and free-text message
//   labels:       human labels for payload keys
//   order:        display order for the remaining fields in admin. Needed because
//                 jsonb does not preserve key order (Postgres sorts keys by length,
//                 then alphabetically), so the order of `labels` means nothing.
//   value_labels: per-field map from raw submitted values to display text,
//                 e.g. { timeline: { "this-week": "This week" } }
export interface FieldMap {
    identity?: {
        name?: string
        email?: string
        message?: string
    }
    labels?: Record<string, string>
    order?: string[]
    value_labels?: Record<string, Record<string, string>>
}

export interface Tenant {
    id: string
    created_at: string
    slug: string
    name: string
    active: boolean
    webhook_key: string
    field_map: FieldMap

    // Prompt building blocks. These replace the Better Call Jon text that
    // used to live in route.ts and groq.ts.
    business_context: string
    hard_rules: string
    classification_rubric: string
    extraction_guidance: string
    urgency_guidance: string
    email_guidance: string
    email_signoff: string

    reply_language: string | null // null = match the submitter's language
    reply_to_email: string | null
    slack_webhook_url: string | null
    settings: Record<string, unknown>
}