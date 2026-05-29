import { NextRequest, NextResponse } from "next/server";
import { groq, MODEL, analysisTools, emailTool } from "@/lib/groq";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { notifySlack } from "@/lib/slack";
import { RawLeadFormData, AIToolResults } from "@/types/lead";
import { checkRateLimit } from "@/lib/ratelimit";
import { withRetry } from "@/lib/retry";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = checkRateLimit(ip);

    if (!allowed) {
        return NextResponse.json(
            { success: false, error: "Too many requests. Please wait a moment." },
            { status: 429, headers: { "X-RateLimit-Remaining": "0" } },
        );
    }

    try {
        const body: RawLeadFormData = await req.json();
        const { name, email, company, budget, timeline, message } = body;

        if (!name || !email || !message) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 },
            );
        }

        const userPrompt = `
      Analyze this inbound lead and use all available tools in parallel:

      Name: ${name}
      Company: ${company}
      Budget: ${budget}
      Timeline: ${timeline}
      Message: ${message}
    `;

        const systemPrompt = `You are a lead qualification AI for a premium agency. 
      You must call ALL THREE analysis tools simultaneously for every lead. 
      Never skip a tool. Be precise and analytical.`;

        // ─────────────────────────────────────────────
        // TURN 1 — PARALLEL TOOL CALLS
        // Wrapped in withRetry — if Groq is flaky,
        // we back off and try up to 3 times before
        // surfacing the error. Timer starts before
        // the call so we capture real network latency.
        // ─────────────────────────────────────────────

        const turn1Start = Date.now();

        const turn1Response = await withRetry(
            () =>
                groq.chat.completions.create({
                    model: MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    tools: analysisTools,
                    tool_choice: "required",
                }),
            {
                maxAttempts: 3,
                baseDelayMs: 500,
                onRetry: (attempt, err) =>
                    console.warn(`[qualify] turn1 retry ${attempt}:`, err),
            },
        );

        const turn1Latency = Date.now() - turn1Start;

        const turn1Message = turn1Response.choices[0].message;
        const toolCalls = turn1Message.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
            throw new Error("Model did not call any tools");
        }

        // ─────────────────────────────────────────────
        // EXECUTE THE TOOLS
        // ─────────────────────────────────────────────

        const toolResults: Record<string, unknown> = {};

        for (const call of toolCalls) {
            const args = JSON.parse(call.function.arguments);
            toolResults[call.function.name] = args;
        }

        const classify = toolResults["classify_lead"] as {
            classification: string;
            confidence: number;
            reasoning: string;
        };

        const intent = toolResults["extract_intent"] as {
            intent: string;
            needs: string[];
        };

        const sentiment = toolResults["analyze_sentiment"] as {
            sentiment: string;
            urgency_score: number;
            tone_notes: string;
        };


        // ─────────────────────────────────────────────
        // TURN 2 — EMAIL DRAFT
        // Instead of passing raw tool_result messages
        // (which confuse the model into hallucinating
        // tool names from Turn 1), we summarize the
        // analysis as plain text. Clean context =
        // deterministic tool call.
        // ─────────────────────────────────────────────

        const analysisSummary = `
  Lead analysis complete. Use this to draft the email:

  Classification: ${classify.classification} (${Math.round(classify.confidence * 100)}% confidence)
  Reasoning: ${classify.reasoning}

  Intent: ${intent.intent}
  Needs: ${intent.needs.join(", ")}

  Sentiment: ${sentiment.sentiment}
  Urgency: ${sentiment.urgency_score}/10
  Tone notes: ${sentiment.tone_notes}

  Now call draft_response_email for ${name} at ${company} (${email}).
`;

        const turn2Start = Date.now();

        const turn2Response = await withRetry(
            () =>
                groq.chat.completions.create({
                    model: MODEL,
                    messages: [
                        {
                            role: "system",
                            content: `You are an expert copywriter for a premium agency. 
Draft personalized response emails based on lead analysis.
Always sign emails as "Jon" — never use placeholders like [Your Name].
Format the email with short paragraphs — maximum 2 sentences per paragraph.
Each distinct thought gets its own paragraph separated by a blank line.
Never write walls of text. White space is professionalism.
Always call the draft_response_email tool. Never respond with plain text.`,
                        },
                        {
                            role: "user",
                            content: analysisSummary,
                        },
                    ],
                    tools: emailTool,
                    tool_choice: "required",
                }),
            {
                maxAttempts: 3,
                baseDelayMs: 500,
                onRetry: (attempt, err) =>
                    console.warn(`[qualify] turn2 retry ${attempt}:`, err),
            },
        );

        const turn2Latency = Date.now() - turn2Start;

        const emailCall = turn2Response.choices[0].message.tool_calls?.[0];

        if (!emailCall) {
            throw new Error("Model did not draft the email");
        }

        const emailDraft = JSON.parse(emailCall.function.arguments) as {
            email_subject: string;
            email_body: string;
        };

        // ─────────────────────────────────────────────
        // ASSEMBLE FINAL RESULTS
        // ─────────────────────────────────────────────

        const aiResults: AIToolResults = {
            classification:
                classify.classification as AIToolResults["classification"],
            confidence: classify.confidence,
            reasoning: classify.reasoning,
            intent: intent.intent,
            needs: intent.needs,
            sentiment: sentiment.sentiment as AIToolResults["sentiment"],
            urgency_score: sentiment.urgency_score,
            tone_notes: sentiment.tone_notes,
            email_subject: emailDraft.email_subject,
            email_body: emailDraft.email_body,
        };

        // ─────────────────────────────────────────────
        // STORAGE + NOTIFICATIONS
        // ─────────────────────────────────────────────

        const supabase = createAdminClient();

        const { data: lead, error: dbError } = await supabase
            .from("leads")
            .insert({
                name,
                email,
                company,
                budget,
                timeline,
                message,
                ...aiResults,
                email_sent: false,
                slack_notified: false,
            })
            .select()
            .single();

        if (dbError) throw new Error(`Supabase insert failed: ${dbError.message}`);

        // Email + Slack fire concurrently
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
        ]);

        // Update sent flags
        await supabase
            .from("leads")
            .update({
                email_sent: emailSent.status === "fulfilled",
                slack_notified: slackSent.status === "fulfilled",
            })
            .eq("id", lead.id);

        // ─────────────────────────────────────────────
        // USAGE TRACKING
        // Log token counts and latency for both turns.
        // Groq returns usage on every completion —
        // we store it so you can monitor costs as you
        // scale or swap models.
        // ─────────────────────────────────────────────

        await supabase.from("usage_logs").insert([
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
        ]);

        return NextResponse.json({
            success: true,
            lead_id: lead.id,
            results: aiResults,
        });
    } catch (error) {
        console.error("[qualify] error:", error);
        return NextResponse.json(
            { success: false, error: "Qualification failed. Please try again." },
            { status: 500 },
        );
    }
}
