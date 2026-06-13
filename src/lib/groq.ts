import Groq from 'groq-sdk'

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
})

export const MODEL = 'llama-3.3-70b-versatile'

// ─────────────────────────────────────────────
// BETTER CALL JON — PI INTAKE TOOL DEFINITIONS
// Tools are scoped to personal injury intake.
// No fees, no legal advice, intake only.
// ─────────────────────────────────────────────

export const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'classify_lead',
      description: `Evaluate a personal injury intake submission for Better Call Jon law firm.
      Classify case viability based on: nature and severity of injury, clarity of at-fault party,
      whether medical treatment was received, recency of incident, and prior attorney contact.
      A hot lead has clear liability, documented injury, recent incident, and no prior attorney.
      A warm lead has some missing details but a viable core claim.
      A cold lead has unclear liability, no injury documentation, or a very stale incident.
      Unqualified means outside personal injury scope entirely.`,
      parameters: {
        type: 'object',
        properties: {
          classification: {
            type: 'string',
            enum: ['hot', 'warm', 'cold', 'unqualified'],
            description: 'Case viability classification',
          },
          confidence: {
            type: 'number',
            description: 'Confidence score from 0 to 1',
          },
          reasoning: {
            type: 'string',
            description: 'One to two sentence legal reasoning for the classification',
          },
        },
        required: ['classification', 'confidence', 'reasoning'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_intent',
      description: `Extract the key facts from a personal injury intake submission.
      Identify the nature of injury, incident date, at-fault party, medical treatment status,
      police report status, and whether the claimant has spoken to another attorney.
      Surface any red flags or strong case indicators.`,
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'One sentence summary of the claim — what happened and what they need',
          },
          needs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key case facts extracted: injury type, incident date, at-fault party, treatment, police report, prior attorney',
          },
        },
        required: ['intent', 'needs'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_sentiment',
      description: `Analyze the emotional state and urgency of a personal injury claimant.
      People in PI intake are often distressed, frustrated, or confused.
      Detect their emotional tone and urgency so the attorney can calibrate their approach.`,
      parameters: {
        type: 'object',
        properties: {
          sentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative', 'urgent'],
            description: 'Dominant emotional tone of the submission',
          },
          urgency_score: {
            type: 'number',
            description: 'Urgency from 1 (no rush) to 10 (statute of limitations concern or acute distress)',
          },
          tone_notes: {
            type: 'string',
            description: 'Notes on emotional state, stress indicators, or communication flags the attorney should know',
          },
        },
        required: ['sentiment', 'urgency_score', 'tone_notes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_response_email',
      description: `Draft a professional, empathetic response email from Better Call Jon law firm
      to a personal injury claimant. The email must:
      - Never discuss fees or payment arrangements
      - Never give legal advice or case assessments
      - Always clarify this is an intake acknowledgment only
      - Be warm but professional — these are people in distress
      - Include a clear next step (a call, a consultation request)
      - Hot cases get priority language and urgency
      - Cold or unqualified cases get a respectful, honest response`,
      parameters: {
        type: 'object',
        properties: {
          email_subject: {
            type: 'string',
            description: 'Professional subject line appropriate for a law firm',
          },
          email_body: {
            type: 'string',
            description: 'Full email body. Empathetic, professional, clear CTA. Short paragraphs. No legal advice. No fee discussion.',
          },
        },
        required: ['email_subject', 'email_body'],
      },
    },
  },
]

export const analysisTools = tools.filter(t =>
  ['classify_lead', 'extract_intent', 'analyze_sentiment'].includes(
    t.function?.name ?? ''
  )
)

export const emailTool = tools.filter(t =>
  t.function?.name === 'draft_response_email'
)