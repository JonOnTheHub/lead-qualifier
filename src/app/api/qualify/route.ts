import { NextRequest, NextResponse } from "next/server";
import { groq, MODEL, reasoningParams, analysisTools, emailTool } from "@/lib/groq";
import { createAdminClient } from "@/lib/supabase/server";
import { notifySlack } from "@/lib/slack";
import { RawLeadFormData, AIToolResults } from "@/types/lead";
import { checkRateLimit } from "@/lib/ratelimit";
import { withRetry } from "@/lib/retry";

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
                role: "system",
                content: `You are a language detector. 
        Respond with only the English name of the language the text is written in.
        Examples: "English", "Spanish", "French", "Yoruba", "Arabic".
        One word only. No punctuation. No explanation.`,
            },
            {
                role: "user",
                content: text,
            },
        ],
        // Reasoning models spend completion tokens on thinking before the
        // answer, so leave real headroom for a one-word reply.
        max_tokens: 200,
        ...reasoningParams,
    });

    // First word, letters only. An empty result falls back to English
    // instead of producing "the claimant wrote in ." in the prompt.
    const raw = res.choices[0].message.content ?? "";
    const language = raw.trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, "");
    return language || "English";
}

// ─────────────────────────────────────────────
// SINGLE FORCED TOOL CALL
// gpt-oss does not reliably emit several tool calls from one
// request, even when told to. So each analysis tool gets its own
// request where it is the ONLY tool available and tool_choice is
// "required". The model cannot skip it. The three requests run
// concurrently, so wall-clock time is still one round trip.
//
// Returns args: null if the model produced nothing usable. The
// caller falls back to safe defaults and logs it.
// ─────────────────────────────────────────────

async function runTool(name: string, system: string, user: string) {
    const tool = analysisTools.filter((t) => t.function?.name === name);

    const res = await withRetry(
        () =>
            groq.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                tools: tool,
                tool_choice: "required",
                ...reasoningParams,
            }),
        {
            maxAttempts: 3,
            baseDelayMs: 500,
            onRetry: (attempt, err) =>
                console.warn(`[qualify] ${name} retry ${attempt}:`, err),
        },
    );

    const call = res.choices[0].message.tool_calls?.find(
        (c) => c.function.name === name,
    );

    let args: Record<string, unknown> | null = null;
    if (call) {
        try {
            args = JSON.parse(call.function.arguments);
        } catch {
            console.warn(`[qualify] ${name} returned unparseable arguments`);
        }
    }
    if (!args) console.warn(`[qualify] ${name} produced no usable output, using fallback`);

    return { args, usage: res.usage };
}

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// The DB has CHECK constraints on classification and sentiment,
// and integer/numeric columns. A model returning "High" or 7.5
// would 500 the insert, so everything is normalized here.
// ─────────────────────────────────────────────

const CLASSIFICATIONS = ["hot", "warm", "cold", "unqualified"] as const;
const SENTIMENTS = ["positive", "neutral", "negative", "urgent"] as const;

function pick<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    fallback: T[number],
): T[number] {
    const v = typeof value === "string" ? value.trim().toLowerCase() : "";
    return (allowed as readonly string[]).includes(v) ? v : fallback;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}

function str(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value : fallback;
}

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

        // company/budget/timeline default to "" so a missing field can't
        // crash the pipeline further down (the DB columns are NOT NULL,
        // and an empty string satisfies that).
        const {
            name,
            email,
            company = "",
            budget = "",
            timeline = "",
            message,
        } = body;

        if (!name || !email || !message) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 },
            );
        }

        // ─────────────────────────────────────────────
        // DETECT LANGUAGE FIRST
        // ─────────────────────────────────────────────

        const detectedLanguage = await detectLanguage(message);

        const languageInstruction =
            detectedLanguage === "English"
                ? ""
                : `IMPORTANT: The claimant wrote in ${detectedLanguage}. 
         All your output — reasoning, intent, tone notes, and especially 
         the email body and subject — must be written in ${detectedLanguage}. 
         Do not respond in English unless the submission was in English.`;

        // Base context shared by every Turn 1 call. The per-tool
        // instruction and the English-output rule are appended after it,
        // and the language instruction comes last. Tool-calling
        // instruction stays ahead of language instruction on purpose.
        const firmContext = `You are an intake assistant for Better Call Jon, 
      a personal injury law firm. You evaluate PI claims and support the 
      intake process. You never give legal advice. You never discuss fees 
      or payment arrangements. You never make promises about case outcomes. 
      You are intake only.
      Be precise. Surface all legally relevant facts.`;

        const turn1System = (toolName: string) => `${firmContext}
      You MUST call the ${toolName} tool. Do not answer in plain text.
      Regardless of the language of the submission, you must still call the tool.
      IMPORTANT: All tool output — reasoning, intent, needs, tone_notes — must be written in English.
      ${languageInstruction}`;

        const userPrompt = `
      Analyze this personal injury intake submission for Better Call Jon:

      Claimant Name: ${name}
      Email: ${email}
      Nature of Injury / What Happened: ${message}
      Incident Date / Timeline: ${timeline}
      At-Fault Party / Context: ${company}
      Medical Treatment Received: ${budget}
    `;

        // ─────────────────────────────────────────────
        // TURN 1 — THREE FORCED TOOL CALLS, CONCURRENT
        // ─────────────────────────────────────────────

        const turn1Start = Date.now();

        const [classifyRun, intentRun, sentimentRun] = await Promise.all([
            runTool("classify_lead", turn1System("classify_lead"), userPrompt),
            runTool("extract_intent", turn1System("extract_intent"), userPrompt),
            runTool("analyze_sentiment", turn1System("analyze_sentiment"), userPrompt),
        ]);

        const turn1Latency = Date.now() - turn1Start;

        // Sum usage across the three requests so usage_logs still has
        // one row per turn. Latency is wall time, not the sum.
        const turn1Usage = [classifyRun, intentRun, sentimentRun].reduce(
            (acc, run) => ({
                prompt_tokens: acc.prompt_tokens + (run.usage?.prompt_tokens ?? 0),
                completion_tokens:
                    acc.completion_tokens + (run.usage?.completion_tokens ?? 0),
                total_tokens: acc.total_tokens + (run.usage?.total_tokens ?? 0),
            }),
            { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        );

        // ─────────────────────────────────────────────
        // VALIDATE + DEFENSIVE FALLBACKS
        // If a tool still yields nothing usable we fall back to safe
        // defaults rather than crashing. Values are clamped to what the
        // DB accepts either way.
        // ─────────────────────────────────────────────

        const classify = {
            classification: pick(classifyRun.args?.classification, CLASSIFICATIONS, "warm"),
            confidence: num(classifyRun.args?.confidence, 0, 1, 0.5),
            reasoning: str(
                classifyRun.args?.reasoning,
                "Classification unavailable — manual review required.",
            ),
        };

        const intent = {
            intent: str(
                intentRun.args?.intent,
                "Unable to extract intent — manual review required.",
            ),
            needs: Array.isArray(intentRun.args?.needs)
                ? (intentRun.args.needs as unknown[]).map(String)
                : [],
        };

        const sentiment = {
            sentiment: pick(sentimentRun.args?.sentiment, SENTIMENTS, "neutral"),
            urgency_score: Math.round(num(sentimentRun.args?.urgency_score, 1, 10, 5)),
            tone_notes: str(
                sentimentRun.args?.tone_notes,
                "Sentiment analysis unavailable — manual review required.",
            ),
        };

        // ─────────────────────────────────────────────
        // TURN 2 — EMAIL DRAFT
        // Plain text summary passed as context (never raw tool_result
        // messages). Language instruction carried through so the
        // email arrives in the claimant's language.
        // ─────────────────────────────────────────────

        const analysisSummary = `
  Intake analysis complete for Better Call Jon. Draft the response email:

  Case Classification: ${classify.classification} (${Math.round(classify.confidence * 100)}% confidence)
  Reasoning: ${classify.reasoning}

  Claim Summary: ${intent.intent}
  Key Facts: ${intent.needs.join(", ")}

  Claimant Sentiment: ${sentiment.sentiment}
  Urgency: ${sentiment.urgency_score}/10
  Tone Notes: ${sentiment.tone_notes}

  Draft a response email for ${name} in ${detectedLanguage}.
  The email body and subject must be written in ${detectedLanguage}.
  Do not use English in the email unless the claimant wrote in English.
`;

        const turn2Start = Date.now();

        const turn2Response = await withRetry(
            () =>
                groq.chat.completions.create({
                    model: MODEL,
                    messages: [
                        {
                            role: "system",
                            content: `You are a professional legal intake coordinator at Better Call Jon, 
            a personal injury law firm. Draft empathetic, professional response emails.
            Never give legal advice. Never discuss fees. Never promise outcomes.
            Never invent phone numbers, email addresses, links, URLs, office addresses, 
            or scheduling tools. You have none. The only next step you may offer is 
            that the claimant replies to this email and the team will follow up.
            Do not describe any consultation as free.
            Always sign as "The Intake Team at Better Call Jon".
            Short paragraphs. Human tone. Clear next step.
            ${languageInstruction}
            Always call the draft_response_email tool.`,
                        },
                        { role: "user", content: analysisSummary },
                    ],
                    tools: emailTool,
                    tool_choice: "required",
                    ...reasoningParams,
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

        if (!emailCall) throw new Error("Model did not draft the email");

        const emailDraft = JSON.parse(emailCall.function.arguments) as {
            email_subject: string;
            email_body: string;
        };

        const aiResults: AIToolResults = {
            classification: classify.classification,
            confidence: classify.confidence,
            reasoning: classify.reasoning,
            intent: intent.intent,
            needs: intent.needs,
            sentiment: sentiment.sentiment,
            urgency_score: sentiment.urgency_score,
            tone_notes: sentiment.tone_notes,
            email_subject: emailDraft.email_subject,
            email_body: emailDraft.email_body,
        };

        // ─────────────────────────────────────────────
        // STORE THE LEAD AS PENDING REVIEW
        // The draft is saved but NOT sent. A human approves from the
        // admin drawer, and the approve action is what sends the email.
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
                status: "pending_review",
            })
            .select()
            .single();

        if (dbError) throw new Error(`Supabase insert failed: ${dbError.message}`);

        // Slack is a heads-up only. If it fails, the lead is still
        // safely in the queue, so we swallow the error.
        let slackNotified = false;
        try {
            await notifySlack({
                name,
                company: company.length > 40 ? `${company.slice(0, 40)}...` : company,
                classification: aiResults.classification,
                urgency_score: aiResults.urgency_score,
                intent: aiResults.intent,
                lead_id: lead.id,
            });
            slackNotified = true;
        } catch (err) {
            console.warn("[qualify] slack failed:", err);
        }

        if (slackNotified) {
            await supabase
                .from("leads")
                .update({ slack_notified: true })
                .eq("id", lead.id);
        }

        await supabase.from("usage_logs").insert([
            {
                lead_id: lead.id,
                model: MODEL,
                ...turn1Usage,
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
            { success: false, error: "Intake submission failed. Please try again." },
            { status: 500 },
        );
    }
}