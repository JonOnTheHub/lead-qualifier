# Intake

AI-powered lead qualification and response system. Every inbound submission is 
classified, analyzed, and responded to automatically — in under 4 seconds, 
before anyone on your team opens their laptop.

Built as a reference implementation for intelligent internal systems. 
The engine is configurable: the same pipeline powers a general agency 
intake and a personal injury law firm demo with full language detection.

**Live:** [useintake.vercel.app](https://useintake.vercel.app)

---

## What It Does

A prospect submits a form. The following happens automatically:

1. **Language detection** — the submission language is identified. All 
   claimant-facing output is returned in that language. Internal output 
   stays in English.

2. **Parallel AI analysis** — three tools fire simultaneously via LLM 
   tool calling:
   - `classify_lead` — scores the submission hot, warm, cold, or unqualified 
     with a confidence percentage and written reasoning
   - `extract_intent` — pulls out what they actually need and surfaces 
     specific requirements
   - `analyze_sentiment` — reads emotional tone, urgency score (1–10), 
     and communication flags

3. **Email draft** — a fourth tool fires sequentially using the analysis 
   results and drafts a personalized response email calibrated to the 
   classification. Hot leads get direct, action-oriented copy. Cold leads 
   get value-focused responses.

4. **Storage** — the full lead and AI output are written to Supabase.

5. **Notifications** — the drafted email is sent to the submitter via 
   Gmail SMTP. A Slack Block Kit notification fires with the lead summary, 
   classification, and urgency score.

6. **Admin dashboard** — a protected `/admin` route shows all leads with 
   classification and sentiment badges, a stats strip, and a detail drawer 
   with the full AI breakdown and email draft.

---

## Technical Architecture
