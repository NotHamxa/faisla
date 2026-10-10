// Reads supplier replies from the team's test Gmail inbox over IMAP (app password).
// Read-only: messages are fetched with BODY.PEEK so nothing is marked as seen.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Supplier } from "./types";

export type InboxMessage = {
  id: string; // Message-ID header, or uid-based fallback
  from: string; // address
  fromName: string;
  subject: string;
  text: string;
  date: string; // ISO
};

export function inboxEnabled(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) && process.env.DEMO_MODE !== "1";
}

const MAX_MESSAGES = 25;

// Messages received after `since` whose subject mentions RFQ / is a reply, or whose sender is a supplier.
export async function fetchReplies(opts: { since: Date; suppliers: Supplier[] }): Promise<InboxMessage[]> {
  if (!inboxEnabled()) return [];
  const own = (process.env.GMAIL_USER ?? "").toLowerCase();
  const supplierEmails = new Set(opts.suppliers.map((s) => s.email.toLowerCase()).filter(Boolean));

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: process.env.GMAIL_USER ?? "", pass: process.env.GMAIL_APP_PASSWORD ?? "" },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 20_000,
    disableAutoIdle: true,
  });
  client.on("error", (error) => console.error("[inbox] IMAP error", error instanceof Error ? error.message : error));

  const messages: InboxMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // IMAP SINCE has day granularity; exact time filtering happens below.
      const day = new Date(opts.since.getTime() - 24 * 3600 * 1000);
      const uids = await client.search({ since: day }, { uid: true });
      const recent = (uids || []).slice(-MAX_MESSAGES);
      if (recent.length === 0) return [];

      for await (const msg of client.fetch(recent, { uid: true, envelope: true, internalDate: true, source: true }, { uid: true })) {
        const received = msg.internalDate ? new Date(msg.internalDate) : null;
        if (!received || received < opts.since || !msg.source) continue;
        const subject = msg.envelope?.subject ?? "";
        const sender = msg.envelope?.from?.[0];
        const from = (sender?.address ?? "").toLowerCase();
        const isReply = /^\s*(re|aw|jawab)\s*:/i.test(subject);
        const mentionsRfq = /\brfq\b/i.test(subject);
        // Our own outgoing RFQ can land here when TEST_INBOX is this account; only replies count then.
        if (from === own && !isReply) continue;
        if (!isReply && !mentionsRfq && !supplierEmails.has(from)) continue;

        const parsed = await simpleParser(msg.source);
        messages.push({
          id: parsed.messageId ?? `uid-${msg.uid}`,
          from,
          fromName: sender?.name ?? "",
          subject: parsed.subject ?? subject,
          text: (parsed.text ?? "").trim(),
          date: received.toISOString(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }
  return messages.sort((a, b) => a.date.localeCompare(b.date));
}
