import { groq, MODEL, reasoningParams, analysisTools, emailTool } from '@/lib/groq'
import { withRetry } from '@/lib/retry'
import type { Tenant } from '@/types/tenant'
import type { AIToolResults } from '@/types/lead'

// ─────────────────────────────────────────────
// THE ENGINE
// Takes a tenant row + a raw payload, returns the AI results.
// No DB, Slack or email in here. Callers (the form route today, the
// webhook route next) decide what to do with the result. That split
// is what lets one engine serve any number of businesses.
// ─────────────────────────────────────────────

export type Payload = Record<string, unknown>

type UsageLike = {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
} | null | undefined

export interface Usage {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
}

export interface PipelineResult {
    ai: AIToolResults
    replyLanguage: string
    turn1: { usage: Usage; latencyMs: number }
    turn2: { usage: Usage; latencyMs: number }
}

// Caps so a huge payload can't blow up the prompt (and the free-tier token budget).
const MAX_FIELD_CHARS = 4000
const MAX_TOTAL_CHARS = 12000

// ─────────────────────────────────────────────
// PAYLOAD HELPERS
// ─────────────────────────────────────────────

function stringify(value: unknown): string {
    if (value == null) return ''
    if (typeof value === 'string') return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    try {
        return JSON.stringify(value)
    } catch {
        return ''
    }
}

function labelFor(tenant: Tenant, key: string): string {
    return tenant.field_map.labels?.[key] ?? key.replace(/[_-]+/g, ' ').trim()
}

// Turns an arbitrary payload into labeled lines for the model. Labeled
// keys come first, in the order the tenant defined them. Unknown keys
// follow, with a prettified key as the label.
export function buildSubmissionText(tenant: Tenant, payload: Payload): string {
    const labels = tenant.field_map.labels ?? {}
    const keys = [
        ...Object.keys(labels).filter(k => k in payload),
        ...Object.keys(payload).filter(k => !(k in labels)),
    ]

    const lines: string[] = []
    let total = 0
    for (const key of keys) {
        const value = stringify(payload[key]).slice(0, MAX_FIELD_CHARS)
        if (!value) continue
        if (total + value.length > MAX_TOTAL_CHARS) break
        total += value.length
        lines.push(`${labelFor(tenant, key)}: ${value}`)
    }
    return lines.join('\n')
}

// Pulls the identity fields out of a payload using the tenant's mapping.
// Defaults to the keys "name", "email" and "message" when unmapped.
export function extractContact(tenant: Tenant, payload: Payload) {
    const id = tenant.field_map.identity ?? {}
    const email = stringify(payload[id.email ?? 'email'])
    const name = stringify(payload[id.name ?? 'name'])
    const message = stringify(payload[id.message ?? 'message'])
    return {
        name: name || (email ? email.split('@')[0] : ''),
        email,
        message,
    }
}

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// The DB has CHECK constraints on classification and sentiment, and
// integer/numeric columns. A model returning "High" or 7.5 would 500
// the insert, so everything is normalized before it leaves the engine.
// ─────────────────────────────────────────────

const CLASSIFICATIONS = ['hot', 'warm', 'cold', 'unqualified'] as const
const SENTIMENTS = ['positive', 'neutral', 'negative', 'urgent'] as const

function pick<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    fallback: T[number],
): T[number] {
    const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return (allowed as readonly string[]).includes(v) ? v : fallback
}

function num(value: unknown, min: number, max: number, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback
}

function str(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback
}

function toUsage(u: UsageLike): Usage {
    return {
        prompt_tokens: u?.prompt_tokens ?? 0,
        completion_tokens: u?.completion_tokens ?? 0,
        total_tokens: u?.total_tokens ?? 0,
    }
}

function sumUsage(list: Usage[]): Usage {
    return list.reduce(
        (acc, u) => ({
            prompt_tokens: acc.prompt_tokens + u.prompt_tokens,
            completion_tokens: acc.completion_tokens + u.completion_tokens,
            total_tokens: acc.total_tokens + u.total_tokens,
        }),
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    )
}

// ─────────────────────────────────────────────
// LANGUAGE DETECTION
// Only used when the tenant doesn't pin a reply language.
// ─────────────────────────────────────────────

async function detectLanguage(text: string): Promise<string> {
    const res = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            {
                role: 'system',
                content: `You are a language detector.
        Respond with only the English name of the language the text is written in.
        Examples: "English", "Spanish", "French", "Yoruba", "Arabic".
        One word only. No punctuation. No explanation.`,
            },
            { role: 'user', content: text.slice(0, 2000) },
        ],
        // Reasoning models spend completion tokens thinking before they
        // answer, so leave real headroom for a one-word reply.
        max_tokens: 200,
        ...reasoningParams,
    })

    // First word, letters only. An empty result falls back to English.
    const raw = res.choices[0].message.content ?? ''
    const language = raw.trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, '')
    return language || 'English'
}

// ─────────────────────────────────────────────
// SINGLE FORCED TOOL CALL
// gpt-oss does not reliably emit several tool calls from one request,
// so each analysis tool gets its own request where it is the ONLY tool
// available and tool_choice is "required". The three run concurrently,
// so wall-clock time is still one round trip.
// ─────────────────────────────────────────────

async function runTool(name: string, system: string, user: string) {
    const tool = analysisTools.filter(t => t.function?.name === name)

    const res = await withRetry(
        () =>
            groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                tools: tool,
                tool_choice: 'required',
                ...reasoningParams,
            }),
        {
            maxAttempts: 3,
            baseDelayMs: 500,
            onRetry: (attempt, err) =>
                console.warn(`[pipeline] ${name} retry ${attempt}:`, err),
        },
    )

    const call = res.choices[0].message.tool_calls?.find(
        c => c.function.name === name,
    )

    let args: Record<string, unknown> | null = null
    if (call) {
        try {
            args = JSON.parse(call.function.arguments)
        } catch {
            console.warn(`[pipeline] ${name} returned unparseable arguments`)
        }
    }
    if (!args) console.warn(`[pipeline] ${name} produced no usable output, using fallback`)

    return { args, usage: toUsage(res.usage) }
}

// ─────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────

export async function runPipeline(
    tenant: Tenant,
    payload: Payload,
): Promise<PipelineResult> {
    const submission = buildSubmissionText(tenant, payload)
    const contact = extractContact(tenant, payload)

    // Pinned language skips the detection call entirely.
    const replyLanguage =
        tenant.reply_language?.trim() ||
        (await detectLanguage(contact.message || submission))

    // ── TURN 1: three forced tool calls, concurrent ──
    // Turn 1 is internal (admin, Slack), so it is always English and
    // never needs to know the submitter's language.

    const base = [
        tenant.business_context,
        tenant.hard_rules,
        'Be precise. Surface all relevant facts.',
    ]
        .filter(Boolean)
        .join('\n')

    const turn1System = (toolName: string, guidance: string) =>
        [
            base,
            guidance,
            `You MUST call the ${toolName} tool. Do not answer in plain text.`,
            'The submission may be written in any language. Regardless of its language, you must still call the tool.',
            'IMPORTANT: All tool output must be written in English.',
        ]
            .filter(Boolean)
            .join('\n\n')

    const userPrompt = `Analyze this inbound lead submission for ${tenant.name}:\n\n${submission}`

    const turn1Start = Date.now()

    const [classifyRun, intentRun, sentimentRun] = await Promise.all([
        runTool('classify_lead', turn1System('classify_lead', tenant.classification_rubric), userPrompt),
        runTool('extract_intent', turn1System('extract_intent', tenant.extraction_guidance), userPrompt),
        runTool('analyze_sentiment', turn1System('analyze_sentiment', tenant.urgency_guidance), userPrompt),
    ])

    const turn1Latency = Date.now() - turn1Start

    // ── VALIDATE + DEFENSIVE FALLBACKS ──

    const classify = {
        classification: pick(classifyRun.args?.classification, CLASSIFICATIONS, 'warm'),
        confidence: num(classifyRun.args?.confidence, 0, 1, 0.5),
        reasoning: str(
            classifyRun.args?.reasoning,
            'Classification unavailable — manual review required.',
        ),
    }

    const intent = {
        intent: str(
            intentRun.args?.intent,
            'Unable to extract intent — manual review required.',
        ),
        needs: Array.isArray(intentRun.args?.needs)
            ? (intentRun.args.needs as unknown[]).map(String)
            : [],
    }

    const sentiment = {
        sentiment: pick(sentimentRun.args?.sentiment, SENTIMENTS, 'neutral'),
        urgency_score: Math.round(num(sentimentRun.args?.urgency_score, 1, 10, 5)),
        tone_notes: str(
            sentimentRun.args?.tone_notes,
            'Sentiment analysis unavailable — manual review required.',
        ),
    }

    // ── TURN 2: email draft ──
    // Plain-text summary as context, never raw tool_result messages
    // (that caused hallucinated tool names).

    const analysisSummary = `
Intake analysis complete for ${tenant.name}. Draft the response email:

Classification: ${classify.classification} (${Math.round(classify.confidence * 100)}% confidence)
Reasoning: ${classify.reasoning}

Summary: ${intent.intent}
Key facts: ${intent.needs.join(', ')}

Sentiment: ${sentiment.sentiment}
Urgency: ${sentiment.urgency_score}/10
Tone notes: ${sentiment.tone_notes}

Draft a response email for ${contact.name || 'the lead'}.
Write the subject and body in ${replyLanguage}.
`

    const turn2System = [
        `You are a professional intake coordinator at ${tenant.name}.`,
        tenant.business_context,
        tenant.hard_rules,
        tenant.email_guidance,
        'Never invent phone numbers, email addresses, links, or scheduling tools that were not given above.',
        tenant.email_signoff ? `Always sign the email as "${tenant.email_signoff}".` : '',
        'Short paragraphs. Human tone. Clear next step.',
        replyLanguage === 'English'
            ? ''
            : `The email subject and body must be written in ${replyLanguage}. Do not use English.`,
        'Always call the draft_response_email tool.',
    ]
        .filter(Boolean)
        .join('\n\n')

    const turn2Start = Date.now()

    const turn2Response = await withRetry(
        () =>
            groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: 'system', content: turn2System },
                    { role: 'user', content: analysisSummary },
                ],
                tools: emailTool,
                tool_choice: 'required',
                ...reasoningParams,
            }),
        {
            maxAttempts: 3,
            baseDelayMs: 500,
            onRetry: (attempt, err) =>
                console.warn(`[pipeline] turn2 retry ${attempt}:`, err),
        },
    )

    const turn2Latency = Date.now() - turn2Start
    const emailCall = turn2Response.choices[0].message.tool_calls?.[0]
    if (!emailCall) throw new Error('Model did not draft the email')

    const draft = JSON.parse(emailCall.function.arguments) as Record<string, unknown>
    const email_subject = str(draft.email_subject, '')
    const email_body = str(draft.email_body, '')
    if (!email_subject || !email_body) throw new Error('Model returned an empty email draft')

    return {
        ai: {
            classification: classify.classification,
            confidence: classify.confidence,
            reasoning: classify.reasoning,
            intent: intent.intent,
            needs: intent.needs,
            sentiment: sentiment.sentiment,
            urgency_score: sentiment.urgency_score,
            tone_notes: sentiment.tone_notes,
            email_subject,
            email_body,
        },
        replyLanguage,
        turn1: {
            usage: sumUsage([classifyRun.usage, intentRun.usage, sentimentRun.usage]),
            latencyMs: turn1Latency,
        },
        turn2: { usage: toUsage(turn2Response.usage), latencyMs: turn2Latency },
    }
}