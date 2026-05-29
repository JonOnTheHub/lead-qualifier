import { NextRequest, NextResponse } from 'next/server'
import { groq, MODEL, analysisTools, emailTool } from '@/lib/groq'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { notifySlack } from '@/lib/slack'
import { RawLeadFormData, AIToolResults } from '@/types/lead'
import Groq from 'groq-sdk'

export async function POST(req: NextRequest) {
    try {
        const body: RawLeadFormData = await req.json()
        const { name, email, company, budget, timeline, message } = body

        // Basic validation
        if (!name || !email || !message) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            )
        }

        // ─────────────────────────────────────────────
        // TURN 1 — PARALLEL TOOL CALLS
        // We send the lead data once. The model reasons
        // and returns THREE tool calls simultaneously.
        // We don't execute them — the model just tells
        // us which tools to call and with what arguments.
        // ─────────────────────────────────────────────

        const userPrompt = `
      Analyze this inbound lead and use all available tools in parallel:

      Name: ${name}
      Company: ${company}
      Budget: ${budget}
      Timeline: ${timeline}
      Message: ${message}
    `

        const turn1Response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a lead qualification AI for a premium agency. 
          You must call ALL THREE analysis tools simultaneously for every lead. 
          Never skip a tool. Be precise and analytical.`,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            tools: analysisTools,
            // "required" forces it to call tools — no plain text responses
            tool_choice: 'required',
        })

        const turn1Message = turn1Response.choices[0].message
        const toolCalls = turn1Message.tool_calls

        if (!toolCalls || toolCalls.length === 0) {
            throw new Error('Model did not call any tools')
        }

        // ─────────────────────────────────────────────
        // EXECUTE THE TOOLS
        // The model told us what to call and what args
        // to use. Now our app does the actual "work" —
        // in this case, parsing the structured JSON
        // arguments the model prepared.
        // ─────────────────────────────────────────────

        const toolResults: Record<string, unknown> = {}

        for (const call of toolCalls) {
            const args = JSON.parse(call.function.arguments)
            toolResults[call.function.name] = args
        }

        const classify = toolResults['classify_lead'] as {
            classification: string
            confidence: number
            reasoning: string
        }

        const intent = toolResults['extract_intent'] as {
            intent: string
            needs: string[]
        }

        const sentiment = toolResults['analyze_sentiment'] as {
            sentiment: string
            urgency_score: number
            tone_notes: string
        }

        // ─────────────────────────────────────────────
        // TURN 2 — SEND RESULTS BACK + REQUEST EMAIL DRAFT
        // We rebuild the full conversation history:
        // user message → assistant tool calls → tool results
        // Then ask for the email draft using those results.
        // The tool_call_id is how the model matches each
        // result to the call it originally made.
        // ─────────────────────────────────────────────

        const toolResultMessages: Groq.Chat.ChatCompletionMessageParam[] = toolCalls.map(call => ({
            role: 'tool' as const,
            tool_call_id: call.id,
            content: JSON.stringify(toolResults[call.function.name]),
        }))

        const turn2Response = await groq.chat.completions.create({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a lead qualification AI for a premium agency. 
          You must call ALL THREE analysis tools simultaneously for every lead. 
          Never skip a tool. Be precise and analytical.`,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
                // The assistant's previous response (the tool calls it made)
                turn1Message,
                // The results of those tool calls
                ...toolResultMessages,
                // Now request the email draft
                {
                    role: 'user',
                    content: `Based on the analysis, draft the response email for ${name} at ${company}.`,
                },
            ],
            tools: emailTool,
            tool_choice: 'required',
        })

        const emailCall = turn2Response.choices[0].message.tool_calls?.[0]

        if (!emailCall) {
            throw new Error('Model did not draft the email')
        }

        const emailDraft = JSON.parse(emailCall.function.arguments) as {
            email_subject: string
            email_body: string
        }

        // ─────────────────────────────────────────────
        // ASSEMBLE FINAL RESULTS
        // All tool outputs merged into one clean object
        // ─────────────────────────────────────────────

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

        // ─────────────────────────────────────────────
        // STORAGE + NOTIFICATIONS
        // Save to Supabase, send email, ping Slack
        // ─────────────────────────────────────────────

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

        // Fire email + Slack concurrently — no need to wait on each other
        const [emailSent, slackSent] = await Promise.allSettled([
            sendEmail({
                to: email,
                subject: emailDraft.email_subject,
                body: emailDraft.email_body,
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

        // Update sent flags
        await supabase
            .from('leads')
            .update({
                email_sent: emailSent.status === 'fulfilled',
                slack_notified: slackSent.status === 'fulfilled',
            })
            .eq('id', lead.id)

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            results: aiResults,
        })

    } catch (error) {
        console.error('[qualify] error:', error)
        return NextResponse.json(
            { success: false, error: 'Qualification failed. Please try again.' },
            { status: 500 }
        )
    }
}