import { NextRequest, NextResponse } from 'next/server'
import { groq, MODEL, analysisTools, emailTool } from '@/lib/groq'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { notifySlack } from '@/lib/slack'
import { RawLeadFormData, AIToolResults } from '@/types/lead'
import { checkRateLimit } from '@/lib/ratelimit'
import { withRetry } from '@/lib/retry'
import Groq from 'groq-sdk'

// ─────────────────────────────────────────────
// LANGUAGE DETECTION
// Runs before the main pipeline.
// Detects the language of the claimant's message
// and returns a plain language name ("Spanish",
// "French", etc.) that we inject into every
// subsequent system prompt.
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
            {
                role: 'user',
                content: text,
            },
        ],
        max_tokens: 10,
    })

    return res.choices[0].message.content?.trim() ?? 'English'
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
    const { allowed } = checkRateLimit(ip)

    if (!allowed) {
        return NextResponse.json(
            { success: false, error: 'Too many requests. Please wait a moment.' },
            { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
        )
    }

    try {
        const body: RawLeadFormData = await req.json()
        const { name, email, company, budget, timeline, message } = body

        if (!name || !email || !message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // ─────────────────────────────────────────────
        // DETECT LANGUAGE FIRST
        // Cheap single call before the main pipeline.
        // Result gets injected into every system prompt
        // so the model responds in the claimant's language.
        // ─────────────────────────────────────────────

        const detectedLanguage = await detectLanguage(message)

        const languageInstruction = detectedLanguage === 'English'
            ? ''
            : `IMPORTANT: The claimant wrote in ${detectedLanguage}. 
         All your output — reasoning, intent, tone notes, and especially 
         the email body and subject — must be written in ${detectedLanguage}. 
         Do not respond in English unless the submission was in English.`

        const firmContext = `You are an intake assistant for Better Call Jon, 
      a personal injury law firm. You evaluate PI claims and support the 
      intake process. You never give legal advice. You never discuss fees 
      or payment arrangements. You never make promises about case outcomes. 
      You are intake only.
      You MUST call ALL THREE analysis tools simultaneously for every submission.
      Never skip a tool regardless of the language of the submission.
      ${languageInstruction}`

        const userPrompt = `
      Analyze this personal injury intake submission for Better Call Jon:

      Claimant Name: ${name}
      Email: ${email}
      Nature of Injury / What Happened: ${message}
      Incident Date / Timeline: ${timeline}
      At-Fault Party / Context: ${company}
      Medical Treatment Received: ${budget}
    `

        // ─────────────────────────────────────────────
        // TURN 1 — PARALLEL TOOL CALLS
        // ─────────────────────────────────────────────

        const turn1Start = Date.now()

        const turn1Response = await withRetry(
            () => groq.chat.completions.create({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `${firmContext}
            Be precise. Surface all legally relevant facts.
  Regardless of the language of the submission, you must still call all three tools.`,
                    },
                    { role: 'user', content: userPrompt },
                ],
                tools: analysisTools,
                tool_choice: 'required',
            }),
            {
                maxAttempts: 3,
                baseDelayMs: 500,
                onRetry: (attempt, err) =>
                    console.warn(`[qualify] turn1 retry ${attempt}:`, err),
            }
        )

        const turn1Latency = Date.now() - turn1Start
        const turn1Message = turn1Response.choices[0].message
        const toolCalls = turn1Message.tool_calls

        if (!toolCalls || toolCalls.length === 0) {
            throw new Error('Model did not call any tools')
        }

        const toolResults: Record<string, unknown> = {}
        for (const call of toolCalls) {
            toolResults[call.function.name] = JSON.parse(call.function.arguments)
        }

        // ─────────────────────────────────────────────
        // DEFENSIVE FALLBACKS
        // If the model skips a tool (happens with non-English
        // prompts where language instruction competes for
        // attention), we fall back to safe defaults rather
        // than crashing. The email draft still runs with
        // whatever we have.
        // ─────────────────────────────────────────────

        const classify = (toolResults['classify_lead'] ?? {
            classification: 'warm',
            confidence: 0.5,
            reasoning: 'Classification unavailable — manual review required.',
        }) as { classification: string; confidence: number; reasoning: string }

        const intent = (toolResults['extract_intent'] ?? {
            intent: 'Unable to extract intent — manual review required.',
            needs: [],
        }) as { intent: string; needs: string[] }

        const sentiment = (toolResults['analyze_sentiment'] ?? {
            sentiment: 'neutral',
            urgency_score: 5,
            tone_notes: 'Sentiment analysis unavailable — manual review required.',
        }) as { sentiment: string; urgency_score: number; tone_notes: string }

        // ─────────────────────────────────────────────
        // TURN 2 — EMAIL DRAFT
        // Plain text summary passed as context.
        // Language instruction carried through so the
        // email arrives in the claimant's language.
        // ─────────────────────────────────────────────

        const analysisSummary = `
      Intake analysis complete for Better Call Jon. Draft the response email:

      Case Classification: ${classify.classification} (${Math.round(classify.confidence * 100)}% confidence)
      Reasoning: ${classify.reasoning}

      Claim Summary: ${intent.intent}
      Key Facts: ${intent.needs.join(', ')}

      Claimant Sentiment: ${sentiment.sentiment}
      Urgency: ${sentiment.urgency_score}/10
      Tone Notes: ${sentiment.tone_notes}

      Draft a response email for ${name}. 
      Remember: no legal advice, no fee discussion, intake acknowledgment only.
      ${languageInstruction}
    `

        const turn2Start = Date.now()

        const turn2Response = await withRetry(
            () => groq.chat.completions.create({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional legal intake coordinator at Better Call Jon, 
            a personal injury law firm. Draft empathetic, professional response emails.
            Never give legal advice. Never discuss fees. Never promise outcomes.
            Always sign as "The Intake Team at Better Call Jon".
            Short paragraphs. Human tone. Clear next step.
            ${languageInstruction}
            Always call the draft_response_email tool.`,
                    },
                    { role: 'user', content: analysisSummary },
                ],
                tools: emailTool,
                tool_choice: 'required',
            }),
            {
                maxAttempts: 3,
                baseDelayMs: 500,
                onRetry: (attempt, err) =>
                    console.warn(`[qualify] turn2 retry ${attempt}:`, err),
            }
        )

        const turn2Latency = Date.now() - turn2Start
        const emailCall = turn2Response.choices[0].message.tool_calls?.[0]

        if (!emailCall) throw new Error('Model did not draft the email')

        const emailDraft = JSON.parse(emailCall.function.arguments) as {
            email_subject: string
            email_body: string
        }

        const aiResults: AIToolResults = {
            classification: classify.classification as AIToolResults['classification'],
            confidence: classify.confidence,
            reasoning: classify.reasoning,
            intent: intent.intent,
            needs: intent.needs,
            sentiment: sentiment.sentiment as AIToolResults['sentiment'],
            urgency_score: sentiment.urgency_score,
            tone_notes: sentiment.tone_notes,
            email_subject: emailDraft.email_subject,
            email_body: emailDraft.email_body,
        }

        const supabase = createAdminClient()

        const { data: lead, error: dbError } = await supabase
            .from('leads')
            .insert({
                name, email, company, budget, timeline, message,
                ...aiResults,
                email_sent: false,
                slack_notified: false,
            })
            .select()
            .single()

        if (dbError) throw new Error(`Supabase insert failed: ${dbError.message}`)

        const [emailSent, slackSent] = await Promise.allSettled([
            sendEmail({
                to: email,
                subject: emailDraft.email_subject,
                body: emailDraft.email_body,
                firmName: 'Better Call Jon',
            }),
            notifySlack({
                name,
                company,
                classification: aiResults.classification,
                urgency_score: aiResults.urgency_score,
                intent: aiResults.intent,
                lead_id: lead.id,
            }),
        ])

        await supabase
            .from('leads')
            .update({
                email_sent: emailSent.status === 'fulfilled',
                slack_notified: slackSent.status === 'fulfilled',
            })
            .eq('id', lead.id)

        await supabase.from('usage_logs').insert([
            {
                lead_id: lead.id,
                model: MODEL,
                prompt_tokens: turn1Response.usage?.prompt_tokens ?? 0,
                completion_tokens: turn1Response.usage?.completion_tokens ?? 0,
                total_tokens: turn1Response.usage?.total_tokens ?? 0,
                turn: 1,
                latency_ms: turn1Latency,
            },
            {
                lead_id: lead.id,
                model: MODEL,
                prompt_tokens: turn2Response.usage?.prompt_tokens ?? 0,
                completion_tokens: turn2Response.usage?.completion_tokens ?? 0,
                total_tokens: turn2Response.usage?.total_tokens ?? 0,
                turn: 2,
                latency_ms: turn2Latency,
            },
        ])

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            results: aiResults,
        })

    } catch (error) {
        console.error('[qualify] error:', error)
        return NextResponse.json(
            { success: false, error: 'Intake submission failed. Please try again.' },
            { status: 500 }
        )
    }
}