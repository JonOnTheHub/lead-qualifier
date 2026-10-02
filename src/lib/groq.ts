import Groq from 'groq-sdk'

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
})

// Model comes from env so the next Groq deprecation is a config change,
// not a code change. llama-3.3-70b-specdec (gone 04/2025) and
// llama-3.3-70b-versatile (gone 08/2026) are both decommissioned.
export const MODEL = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b'

// gpt-oss is a reasoning model. Low effort keeps latency and free-tier
// token burn down for these structured tasks. Spread this into every
// completion call. Other models get no param.
export const reasoningParams = MODEL.startsWith('openai/gpt-oss')
  ? { reasoning_effort: 'low' as const }
  : {}

// ─────────────────────────────────────────────
// GENERIC TOOL DEFINITIONS
// The schemas are the same for every tenant. Anything domain-specific
// (what hot means, which facts to extract, what urgency means, how the
// email should read) comes from the tenant row and is injected into the
// system prompt by lib/pipeline.ts. Keep these descriptions
// business-neutral or they leak one tenant's domain into another's.
// ─────────────────────────────────────────────

export const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'classify_lead',
      description: `Classify an inbound lead using the classification rubric in the system prompt.
      Hot, warm, cold and unqualified are defined by that rubric, not by general sales conventions.`,
      parameters: {
        type: 'object',
        properties: {
          classification: {
            type: 'string',
            enum: ['hot', 'warm', 'cold', 'unqualified'],
            description: 'Lead classification according to the rubric',
          },
          confidence: {
            type: 'number',
            description: 'Confidence score from 0 to 1',
          },
          reasoning: {
            type: 'string',
            description: 'One to two sentence reasoning for the classification',
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
      description: `Summarize what the lead wants and extract the key facts they stated,
      following the extraction guidance in the system prompt. Only include facts the lead
      actually provided. Never list something just to say it was not mentioned.`,
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'One sentence summary: what the lead is asking for or reporting, and what they need',
          },
          needs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key facts the lead stated, per the extraction guidance. Omit anything not mentioned.',
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
      description: `Analyze the emotional state and urgency of the person who submitted the lead,
      following the urgency guidance in the system prompt. Detect their tone and urgency so the
      team can calibrate their approach.`,
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
            description: 'Urgency from 1 (no rush) to 10 (extremely urgent), per the urgency guidance',
          },
          tone_notes: {
            type: 'string',
            description: 'Notes on emotional state, stress indicators, or communication flags the team should know',
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
      description: `Draft a response email to the lead on behalf of the business, following the
      business rules and email guidance in the system prompt. The email must follow the hard rules,
      include a clear next step, and never invent contact details or links.`,
      parameters: {
        type: 'object',
        properties: {
          email_subject: {
            type: 'string',
            description: 'Subject line appropriate for the business',
          },
          email_body: {
            type: 'string',
            description: 'Full email body. Short paragraphs, human tone, clear next step.',
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

export const emailTool = tools.filter(
  t => t.function?.name === 'draft_response_email'
)