// Outgoing email. One Gmail test account (app password) sends RFQs and the bank email.
// Without credentials, emails are logged as simulated so the demo path still works.
import nodemailer from "nodemailer";

export type SendResult = { sent: boolean; simulated: boolean; id: string; error?: string };

export function emailEnabled(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Safety: only team test inboxes may receive mail. Anything else is redirected to TEST_INBOX.
function safeRecipient(to: string): string {
  const allowed = (process.env.ALLOWED_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.includes(to.toLowerCase())) return to;
  return process.env.TEST_INBOX ?? process.env.GMAIL_USER ?? to;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<SendResult> {
  const id = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!emailEnabled()) return { sent: false, simulated: true, id };
  try {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const info = await transport.sendMail({
      from: `Faisla for ${process.env.COMPANY_NAME ?? "Hamza Garments"} <${process.env.GMAIL_USER}>`,
      to: safeRecipient(opts.to),
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments,
    });
    return { sent: true, simulated: false, id: info.messageId ?? id };
  } catch (error) {
    return { sent: false, simulated: true, id, error: error instanceof Error ? error.message : String(error) };
  }
}
