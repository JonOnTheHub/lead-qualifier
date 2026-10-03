interface SlackLeadPayload {
  name: string
  context: string // short extra line next to the name (may be empty)
  classification: string
  urgency_score: number
  intent: string
  lead_id: string
  tenantName: string
}

// Color coding the Slack attachment sidebar by classification
const classificationColor: Record<string, string> = {
  hot: '#C8102E',
  warm: '#E87722',
  cold: '#4A90D9',
  unqualified: '#666666',
}

// Slack mrkdwn treats &, < and > as control characters. Claimant-supplied
// text containing <!channel> or <https://evil|click here> would otherwise
// ping the whole channel or render a disguised link. Slack's own docs say
// to escape exactly these three.
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

// Returns true if a message was actually sent, false if no webhook is
// configured. Throws if Slack rejects the request. Callers use the return
// value to decide whether to mark the lead as notified.
export async function notifySlack(
  payload: SlackLeadPayload,
  tenantWebhookUrl?: string | null,
): Promise<boolean> {
  const { name, context, classification, urgency_score, intent, lead_id, tenantName } = payload

  // The tenant's own webhook wins. The env var is the fallback so the
  // existing setup keeps working until a tenant gets its own channel.
  const webhookUrl = tenantWebhookUrl || process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('[slack] no webhook configured for this tenant or in env — skipping')
    return false
  }

  const headline = [esc(name), context ? esc(truncate(context, 40)) : '']
    .filter(Boolean)
    .join(' · ')

  // Slack Block Kit — structured message with a colored sidebar
  const body = {
    attachments: [
      {
        color: classificationColor[classification] ?? '#666666',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              // Classification uppercased as a visual anchor
              text: `*New Lead — ${classification.toUpperCase()}*\n${headline}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Urgency*\n${urgency_score} / 10`,
              },
              {
                type: 'mrkdwn',
                text: `*Lead ID*\n\`${lead_id.slice(0, 8)}\``,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              // Section text is capped at 3000 chars by Slack. Intent is one
              // sentence in practice, but never trust model output for size.
              text: `*Intent*\n${esc(truncate(intent, 600))}`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                // Nothing has been sent yet. A human approves the draft first.
                text: `Intake · ${esc(tenantName)} · Draft awaiting review`,
              },
            ],
          },
        ],
      },
    ],
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`)
  }

  return true
}