import Groq from 'groq-sdk'

// Single Groq client instance — reused across the app
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
})

// Model we're using — llama 3.3 70b supports parallel tool calling
export const MODEL = 'llama-3.3-70b-versatile'

// ─────────────────────────────────────────────
// TOOL DEFINITIONS
// This is what you send to the model so it knows
// what tools exist, what they do, and what shape
// of arguments to pass. The model reads these
// descriptions the same way you read a menu.
// ─────────────────────────────────────────────

export const tools: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'classify_lead',
      description: `Analyze a sales lead and classify their quality based on their message, 
      budget, and timeline. Return a classification of hot, warm, cold, or unqualified 
      with a confidence score and reasoning.`,
      parameters: {
        type: 'object',
        properties: {
          classification: {
            type: 'string',
            enum: ['hot', 'warm', 'cold', 'unqualified'],
            description: 'The lead quality classification',
          },
          confidence: {
            type: 'number',
            description: 'Confidence score from 0 to 1',
          },
          reasoning: {
            type: 'string',
            description: 'One to two sentence explanation of the classification',
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
      description: `Extract the primary business intent and specific needs from a lead's 
      message. What are they trying to accomplish and what do they need to get there.`,
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'A single clear sentence describing what the lead wants to achieve',
          },
          needs: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of specific needs or requirements mentioned or implied',
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
      description: `Analyze the emotional tone and urgency of a lead's message. 
      Detect whether they are positive, neutral, negative, or urgent in their communication.`,
      parameters: {
        type: 'object',
        properties: {
          sentiment: {
            type: 'string',
            enum: ['positive', 'neutral', 'negative', 'urgent'],
            description: 'The dominant emotional tone of the message',
          },
          urgency_score: {
            type: 'number',
            description: 'Urgency score from 1 (no rush) to 10 (needs this immediately)',
          },
          tone_notes: {
            type: 'string',
            description: 'Brief notes on communication style and any red or green flags',
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
      description: `Draft a professional, personalized response email to a lead. 
      Use their classification, intent, and sentiment to tailor the tone and content. 
      Hot leads get direct and action-oriented emails. Warm leads get nurturing emails. 
      Cold leads get value-focused emails.`,
      parameters: {
        type: 'object',
        properties: {
          email_subject: {
            type: 'string',
            description: 'A compelling, personalized email subject line',
          },
          email_body: {
            type: 'string',
            description: 'The full email body. Professional, concise, with a clear CTA.',
          },
        },
        required: ['email_subject', 'email_body'],
      },
    },
  },
]

// The three tools that fire in parallel on submission
// draft_response_email fires after, using their results
export const analysisTools = tools.filter(t =>
  ['classify_lead', 'extract_intent', 'analyze_sentiment'].includes(
    t.function?.name ?? ''
  )
)

export const emailTool = tools.filter(t =>
  t.function?.name === 'draft_response_email'
)