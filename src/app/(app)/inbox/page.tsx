// Inbox: every email sent or received across the company's decisions, newest first.
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listDecisions } from "@/lib/server/repo";
import { type InboxItem, InboxView } from "@/components/inbox/inbox-view";

export const metadata: Metadata = { title: "Inbox · Faisla" };

export default async function InboxPage() {
  const user = await requireUser();
  const decisions = await listDecisions(user.companyId);
  const items: InboxItem[] = decisions
    .flatMap((d) =>
      d.emails.map((email) => ({
        key: `${d.id}:${email.id}`,
        decisionId: d.id,
        decisionTitle: d.title,
        email,
        // The offer the reply-reader extracted from this email, if any.
        offer: email.offerId ? (d.offers.find((o) => o.id === email.offerId) ?? null) : null,
      })),
    )
    .sort((a, b) => b.email.sentAt.localeCompare(a.email.sentAt));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          RFQs sent to suppliers, their replies (AI reads them, code checks the numbers) and term-sheet requests to the
          bank.
        </p>
      </div>
      <InboxView items={items} />
    </div>
  );
}
