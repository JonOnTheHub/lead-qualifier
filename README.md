# Intake

AI-powered lead qualification and response system. Every inbound submission is classified, analyzed, and responded to automatically — in under 4 seconds, before anyone on your team opens their laptop.

Built as a reference implementation for intelligent internal systems. The engine is configurable: the same pipeline powers a general agency intake and a personal injury law firm demo with full language detection.

**Live:** [useintake.vercel.app](https://useintake.vercel.app)

---

## What It Does

A prospect submits a form. The following happens automatically:

1. **Language detection** — the submission language is identified. All claimant-facing output is returned in that language. Internal output stays in English.

2. **Parallel AI analysis** — three tools fire simultaneously via LLM tool calling:

   * `classify_lead` — scores the submission as hot, warm, cold, or unqualified with a confidence percentage and written reasoning.
   * `extract_intent` — identifies what they actually need and surfaces specific requirements.
   * `analyze_sentiment` — reads emotional tone, urgency score (1–10), and communication flags.

3. **Email draft** — a fourth tool fires sequentially using the analysis results and drafts a personalized response email calibrated to the classification. Hot leads get direct, action-oriented copy. Cold leads get value-focused responses.

4. **Storage** — the full lead and AI output are written to Supabase.

5. **Notifications** — the drafted email is sent to the submitter via Gmail SMTP. A Slack Block Kit notification fires with the lead summary, classification, and urgency score.

6. **Admin dashboard** — a protected `/admin` route shows all leads with classification and sentiment badges, a stats strip, and a detail drawer with the full AI breakdown and email draft.

---

## Technical Architecture

```text
Form Submission
       │
       ▼
Language Detection (Groq — single call, max 10 tokens)
       │
       ▼
Turn 1 — Parallel Tool Calls (Groq)
       │
       ├── classify_lead
       │
       ├── extract_intent
       │
       └── analyze_sentiment
       │
       ▼
Turn 2 — Sequential Tool Call (Groq)
       │
       └── draft_response_email
           (uses Turn 1 results as plain-text context)
       │
       ▼
┌──────────────────────────────┐
│  Supabase insert             │
│  Nodemailer → Gmail SMTP     │
│  Slack Webhook (Block Kit)   │
└──────────────────────────────┘
       │
       ▼
Admin Dashboard (/admin)
```

### Why Tool Calling Over Plain Prompting

Plain prompting returns unstructured text. In a production pipeline, parsing unstructured text is where systems break.

Tool calling forces structured JSON output by design — every field is typed, required, and schema-validated before it touches the database.

**No regex. No hallucinated keys. Deterministic by construction.**

The three analysis tools fire in parallel in a single API call. The model returns all three tool calls simultaneously. They are executed concurrently, and their results are assembled before Turn 2 runs.

---

## Production Hardening

| Feature             | Implementation                                           |
| ------------------- | -------------------------------------------------------- |
| Rate limiting       | In-memory per-IP, 3 requests / 60s window                |
| Retry logic         | Exponential backoff, up to 3 attempts (500ms → 1s → 2s)  |
| Usage tracking      | Token counts and latency per turn logged to Supabase     |
| Defensive fallbacks | Safe defaults if model skips a tool on non-English input |
| Admin auth          | Cookie-gated server layout, redirects to `/` on failure  |

---

## Stack

| Layer         | Tool                                |
| ------------- | ----------------------------------- |
| Framework     | Next.js 16 (App Router)             |
| AI            | Groq — LLaMA 3.3 70B                |
| Database      | Supabase (PostgreSQL)               |
| Email         | Nodemailer + Gmail SMTP             |
| Notifications | Slack Incoming Webhooks (Block Kit) |
| Styling       | Tailwind v4 + Framer Motion         |
| Deployment    | Vercel                              |

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

Two tables are used:

* **`leads`** — stores the full submission and AI output.
* **`usage_logs`** — tracks token counts and latency per pipeline turn for cost monitoring as models or volumes change.

Run the SQL in `/supabase/schema.sql` against your Supabase project to initialize the database.

---

## Configuration

The pipeline is designed to be reconfigured per business context.

The two files that define the business logic are:

```text
src/lib/groq.ts
src/app/api/qualify/route.ts
```

* **`src/lib/groq.ts`** — tool definitions.
* **`src/app/api/qualify/route.ts`** — system prompts and pipeline logic.

Changing those two files allows the same underlying system to be redeployed for an entirely different domain.

### Personal Injury Law Firm Variant

A personal injury law firm variant is included as a reference implementation with:

* PI-specific intake fields.
* Hardened system prompts.
* No legal advice.
* No fee discussion.
* Intake-only behavior.
* Language detection.
* Claimant-facing output routed to the claimant's language.
* Internal output kept in English.

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/JonOnTheHub/intake
cd intake
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the required environment variables.

### 4. Start the development server

```bash
npm run dev
```

The application will be available locally at:

```text
http://localhost:3000
```

---

## What This Demonstrates

### AI & LLM Engineering

* **LLM tool calling** with parallel and sequential execution patterns.
* **Deterministic AI workflows** using structured output and typed schemas.
* **No free-text parsing** in production paths.
* **Multi-turn conversation management** with full history reconstruction across pipeline turns.
* **Language detection and routing** in a real pipeline context.

### Production Engineering

* Retry logic with exponential backoff.
* Per-IP rate limiting.
* Usage and token tracking.
* Latency monitoring.
* Defensive fallbacks.
* Protected admin routes.
* Structured database persistence.

### Full-Stack AI Integration

The project demonstrates a complete AI-powered workflow from:

```text
Form Submission
      ↓
Language Detection
      ↓
Parallel AI Analysis
      ↓
Response Generation
      ↓
Supabase
      ↓
Email
      ↓
Slack Notification
      ↓
Admin Dashboard
```

All of this happens in a single coherent system.

---

## Project Structure

```text
intake/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── qualify/
│   │   │       └── route.ts
│   │   └── admin/
│   └── lib/
│       └── groq.ts
│
├── supabase/
│   └── schema.sql
│
├── .env.example
├── .env.local
├── package.json
└── README.md
```

---

## Deployment

The application is designed to deploy directly to Vercel.

Set the required environment variables in your Vercel project:

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

Then deploy:

```bash
npm run build
```

Or connect the repository to Vercel for automatic deployments.

---

## Live Demo

**Production:** [useintake.vercel.app](https://useintake.vercel.app)

---

## Author

Built by [Jon Osaghae](https://linkedin.com/in/jon-osaghae).

**AI integration and intelligent internal systems for businesses.**
