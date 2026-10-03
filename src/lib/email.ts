import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

interface SendEmailParams {
  to: string
  subject: string
  body: string
  firmName?: string
  // Where the claimant's reply should go. The message still sends from our
  // Gmail account, but replying lands in the tenant's own inbox.
  replyTo?: string | null
}

// The draft comes from a model that read claimant-written text, and the
// reviewer can edit it too. Anything dropped into the HTML part has to be
// escaped, otherwise a submission containing markup becomes live markup
// (links, images, fake buttons) inside an email that went out under the
// firm's name. The plain-text part below stays raw, which is correct.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendEmail({
  to, subject, body, firmName = 'Better Call Jon', replyTo,
}: SendEmailParams) {
  const paragraphs = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => `<p style="margin:0 0 18px;line-height:1.7;">${escapeHtml(line)}</p>`)
    .join('')

  // Display name in the From header: no quotes or line breaks, so a
  // firm name can't break out of the header or inject new ones.
  const safeFromName = firmName.replace(/["\r\n]/g, '').trim()

  await transporter.sendMail({
    from: `"${safeFromName}" <${process.env.GMAIL_USER}>`,
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    text: body,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </head>
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif;">
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:#f4f4f4;padding:48px 16px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0"
                  style="max-width:600px;width:100%;">

                  <tr>
                    <td style="background:#0B1120;padding:28px 40px;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:15px;
                        color:#E8D9B0;letter-spacing:0.05em;">
                        ${escapeHtml(firmName)}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#B8C722;height:2px;
                      font-size:0;line-height:0;">&nbsp;</td>
                  </tr>

                  <tr>
                    <td style="background:#ffffff;padding:48px 40px;">
                      <div style="font-family:Georgia,serif;font-size:15px;color:#1a1a1a;">
                        ${paragraphs}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#0B1120;padding:24px 40px;">
                      <p style="margin:0;font-family:monospace;font-size:10px;
                        color:#444;letter-spacing:0.1em;text-transform:uppercase;">
                        This communication is confidential and intended solely
                        for its addressee. It does not constitute legal advice.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  })
}