interface SlackLeadPayload {
  name: string
  company: string
  classification: string
  urgency_score: number
  intent: string
  lead_id: string
}

// Color coding the Slack attachment sidebar by classification
const classificationColor: Record<string, string> = {
  hot: '#C8102E',
  warm: '#E87722',
  cold: '#4A90D9',
  unqualified: '#666666',
}

export async function notifySlack(payload: SlackLeadPayload) {
  const { name, company, classification, urgency_score, intent, lead_id } = payload

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('[slack] SLACK_WEBHOOK_URL not set — skipping notification')
    return
  }

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
              text: `*New Lead — ${classification.toUpperCase()}*\n${name} · ${company}`,
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
              text: `*Intent*\n${intent}`,
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
                text: `Processed by AI Lead Qualifier · Response email sent`,
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
}