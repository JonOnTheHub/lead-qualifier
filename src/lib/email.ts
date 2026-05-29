import nodemailer from 'nodemailer'

// Nodemailer transport using Gmail SMTP.
// Gmail requires an App Password — not your regular password.
// Generate one at: myaccount.google.com → Security → 2-Step Verification → App Passwords
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
    await transporter.sendMail({
        from: `"Lead Qualifier" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        // Plain text fallback
        text: body,
        // Minimal HTML wrap — preserves line breaks from the AI draft
        html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; line-height: 1.7;">
        ${body.split('\n').map(line => `<p style="margin: 0 0 12px;">${line}</p>`).join('')}
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
        <p style="font-size: 11px; color: #999; font-family: monospace;">Sent via AI Lead Qualifier</p>
      </div>
    `,
    })
}