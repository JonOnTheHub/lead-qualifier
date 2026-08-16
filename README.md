# Intake

**AI-powered lead qualification and response system.**

Every inbound submission is classified, analyzed, and responded to automatically — in under four seconds, before anyone on your team opens their laptop.

Built as a reference implementation for intelligent internal systems, the engine is fully configurable. The same pipeline can power a general agency intake workflow or a personal injury law firm demo, with full language detection and multilingual claimant-facing responses.

**Live:** [useintake.vercel.app](https://useintake.vercel.app)

---

## What It Does

A prospect submits an intake form, and the following pipeline runs automatically:

1. **Language Detection**
   The submission language is identified. All claimant-facing output is returned in the detected language, while internal analysis remains in English.

2. **Parallel AI Analysis**
   Three analysis tools execute simultaneously via LLM tool calling:

   * `classify_lead` — classifies the submission as **hot, warm, cold, or unqualified**, with a confidence percentage and written reasoning.
   * `extract_intent` — identifies what the prospect actually needs and surfaces specific requirements.
   * `analyze_sentiment` — evaluates emotional tone, assigns an urgency score from **1–10**, and identifies relevant communication flags.

3. **Email Drafting**
   A fourth tool runs sequentially using the results from the three analysis tools. It generates a personalized response calibrated to the lead classification:

   * **Hot leads** receive direct, action-oriented messaging.
   * **Warm leads** receive personalized follow-up messaging.
   * **Cold leads** receive value-focused responses.

4. **Storage**
   The complete submission, analysis results, and generated response are stored in Supabase.

5. **Notifications**
   The drafted email is sent to the submitter through Gmail SMTP. A Slack Block Kit notification is also sent internally with the lead summary, classification, and urgency score.

6. **Admin Dashboard**
   A protected `/admin` route provides an overview of all leads, including:

   * Classification badges
   * Sentiment and urgency indicators
   * Pipeline statistics
   * Full AI analysis
   * Generated email drafts
   * Lead detail drawer

---

## Technical Architecture

```text
Form Submission
       │
       ▼
Language Detection
(Groq — single call, max 10 tokens)
       │
       ▼
Turn 1 — Parallel Tool Calls
(Groq)
       │
       ├── classify_lead
       ├── extract_intent
       └── analyze_sentiment
       │
       ▼
Turn 2 — Sequential Tool Call
(Groq)
       │
       └── draft_response_email
           Uses Turn 1 results as context
       │
       ▼
┌──────────────────────────────┐
│ Supabase Insert              │
│ Nodemailer → Gmail SMTP      │
│ Slack Webhook → Block Kit    │
└──────────────────────────────┘
       │
       ▼
Admin Dashboard
(/admin)
```

---

## Why Tool Calling Over Plain Prompting?

Plain prompting produces unstructured text that must be parsed before it can safely enter a production workflow.

Tool calling solves this by forcing the model to return structured output against a defined schema. Every field is typed, required, and schema-validated before the result reaches the database.

**No regex. No free-text parsing. No guessing at model output.**

The three analysis tools also execute in parallel within a single API call. The model returns all three tool calls simultaneously, after which they are executed concurrently. Their results are assembled and passed into the sequential email-drafting step.

This creates a predictable pipeline while still using an LLM for the parts of the workflow that require reasoning.

---

## Production Hardening

| Feature                  | Implementation                                                            |
| ------------------------ | ------------------------------------------------------------------------- |
| **Rate limiting**        | In-memory per-IP limit of 3 requests per 60-second window                 |
| **Retry logic**          | Exponential backoff with up to 3 attempts: 500ms → 1s → 2s                |
| **Usage tracking**       | Token counts and latency recorded per pipeline turn in Supabase           |
| **Defensive fallbacks**  | Safe defaults when the model skips a tool, including on non-English input |
| **Admin authentication** | Cookie-gated server layout with redirect to `/` on authentication failure |

---

## Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| **Framework**     | Next.js 16 — App Router             |
| **AI**            | Groq — LLaMA 3.3 70B                |
| **Database**      | Supabase — PostgreSQL               |
| **Email**         | Nodemailer + Gmail SMTP             |
| **Notifications** | Slack Incoming Webhooks + Block Kit |
| **Styling**       | Tailwind CSS v4 + Framer Motion     |
| **Deployment**    | Vercel                              |

**Zero paid third-party services beyond hosting.**

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLACK_WEBHOOK_URL=
GMAIL_USER=
GMAIL_APP_PASSWORD=
ADMIN_SECRET=
```

---

## Database Schema

The application uses two tables:

### `leads`

Stores the complete submission, classification results, sentiment analysis, extracted intent, and generated email response.

### `usage_logs`

Tracks token usage and latency for each pipeline turn, making it possible to monitor costs and performance as model selection or lead volume changes.

Initialize the database by running the SQL in:

```text
/supabase/schema.sql
```

---

## Configuration

The pipeline is designed to be reconfigured for different business contexts.

Two files define the majority of the business-specific logic:

```text
src/lib/groq.ts
src/app/api/qualify/route.ts
```

* `src/lib/groq.ts` contains the tool definitions and their schemas.
* `src/app/api/qualify/route.ts` contains the system prompts and pipeline logic.

Changing these files allows the same underlying architecture to be redeployed for an entirely different domain.

### Personal Injury Law Firm Variant

A personal injury law firm configuration is included as a reference implementation. It demonstrates:

* PI-specific intake fields
* Hardened system prompts
* Explicit restrictions against providing legal advice
* No fee or pricing discussions
* Intake-focused responses
* Multilingual claimant-facing output
* English-only internal analysis

---

## Local Development

Clone the repository and install the dependencies:

```bash
git clone https://github.com/JonOnTheHub/intake
cd intake
npm install
cp .env.example .env.local
```

Add your environment variables to `.env.local`, then start the development server:

```bash
npm run dev
```

---

## What This Demonstrates

### LLM Tool Calling

Demonstrates both **parallel and sequential tool execution patterns** within a production-style AI workflow.

### Deterministic AI Workflows

Uses structured schemas and typed outputs instead of relying on free-form model responses or regex-based parsing.

### Multi-Turn Conversation Management

Reconstructs the full conversation history across pipeline turns, allowing downstream tools to work from the results of previous analysis steps.

### Language Detection and Routing

Detects the language of each submission and routes claimant-facing communication accordingly while keeping internal analysis in English.

### Production Engineering Patterns

Includes practical safeguards such as:

* Retry logic
* Rate limiting
* Usage tracking
* Latency monitoring
* Defensive fallbacks
* Protected admin routes

### Full-Stack AI Integration

Demonstrates an end-to-end workflow connecting:

**Form → AI analysis → database → email → Slack → admin dashboard**

All within a single coherent system.

---

## Built By

**Jon Osaghae**

AI integration and intelligent internal systems for businesses.

[LinkedIn](https://linkedin.com/in/jon-osaghae)
