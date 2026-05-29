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
}

export async function sendEmail({ to, subject, body }: SendEmailParams) {
    // Convert line breaks into proper paragraphs
    // Filter empty lines so we don't get ghost paragraph spacing
    const paragraphs = body
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => `<p style="margin:0 0 18px;line-height:1.7;">${line}</p>`)
        .join('')

    await transporter.sendMail({
        from: `"Jon, via Intake." <${process.env.GMAIL_USER}>`,
        to,
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
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:48px 16px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

                  <!-- Header bar -->
                  <tr>
                    <td style="background:#0a0a0a;padding:28px 40px;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#F5F0E8;letter-spacing:0.05em;">
                        Jon, via Intake.
                      </p>
                    </td>
                  </tr>

                  <!-- Red accent line -->
                  <tr>
                    <td style="background:#C8102E;height:2px;font-size:0;line-height:0;">&nbsp;</td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="background:#ffffff;padding:48px 40px;">
                      <div style="font-family:Georgia,serif;font-size:15px;color:#1a1a1a;">
                        ${paragraphs}
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#0a0a0a;padding:24px 40px;">
                      <p style="margin:0;font-family:monospace;font-size:10px;color:#444;letter-spacing:0.1em;text-transform:uppercase;">
                        This message is intended solely for its addressee.
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