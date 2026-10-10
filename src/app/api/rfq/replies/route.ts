// GET  ?since=ISO&qty=4&model=…&item=…&referenceUnitPrice=…&suppliers=<JSON Supplier[]>
//      → reads the test Gmail inbox (IMAP) → { replies }; without credentials → { replies: [], simulated: true }.
// POST { from, subject, body, supplierName?, qty, model, item, referenceUnitPrice, suppliers }
//      → same extraction on pasted text (demo fallback "Paste a reply").
// Each reply: { email: EmailRecord, offer: Offer | null, needsOwnerInput?: string }.
import { apiUser } from "@/lib/auth/api";
import { DEMO_ITEM, DEMO_MODEL } from "@/lib/demoData";
import { extractPaymentDetails } from "@/lib/fraud";
import { fetchReplies, inboxEnabled, type InboxMessage } from "@/lib/inbox";
import { buildReplyOffer, extractReply, hashString } from "@/lib/replyParser";
import { resolveDemoSuppliers, sameSupplier } from "@/lib/suppliers";
import type { EmailRecord, Offer, Supplier } from "@/lib/types";

export const maxDuration = 30;

type ReplyItem = { email: EmailRecord; offer: Offer | null; needsOwnerInput?: string };
type Context = { qty: number; model: string; item: string; referenceUnitPrice: number | null; suppliers: Supplier[] };

export async function GET(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const params = new URL(request.url).searchParams;
  if (!inboxEnabled()) return Response.json({ replies: [], simulated: true });

  const sinceParam = params.get("since");
  const since = sinceParam && !Number.isNaN(Date.parse(sinceParam)) ? new Date(sinceParam) : new Date(Date.now() - 3600_000);
  const ctx: Context = {
    qty: positiveInt(params.get("qty")) ?? 1,
    model: params.get("model") || DEMO_MODEL,
    item: params.get("item") || DEMO_ITEM,
    referenceUnitPrice: positiveInt(params.get("referenceUnitPrice")),
    suppliers: parseSuppliers(params.get("suppliers")),
  };

  try {
    const messages = await Promise.race([
      fetchReplies({ since, suppliers: ctx.suppliers }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("IMAP timed out")), 25_000)),
    ]);
    const replies = await Promise.all(messages.map((m) => readReply(m, ctx, false)));
    return Response.json({ replies });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[rfq/replies] inbox read failed", message);
    return Response.json({ replies: [], error: `Could not read inbox: ${message}` });
  }
}

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const body = (await request.json().catch(() => ({}))) as {
    from?: string;
    subject?: string;
    body?: string;
    supplierName?: string;
    qty?: number;
    model?: string;
    item?: string;
    referenceUnitPrice?: number | null;
    suppliers?: Supplier[];
  };
  const text = body.body?.trim();
  if (!text) return Response.json({ needsOwnerInput: true, reason: "Paste the reply text" }, { status: 400 });

  const ctx: Context = {
    qty: positiveInt(body.qty) ?? 1,
    model: body.model || DEMO_MODEL,
    item: body.item || DEMO_ITEM,
    referenceUnitPrice: positiveInt(body.referenceUnitPrice),
    suppliers: Array.isArray(body.suppliers) && body.suppliers.length ? body.suppliers : resolveDemoSuppliers(),
  };
  const from = body.from?.trim() ?? "";
  const message: InboxMessage = {
    id: `pasted-${hashString(`${from}|${body.subject ?? ""}|${text}`)}`,
    from,
    fromName: body.supplierName ?? "",
    subject: body.subject?.trim() || "Pasted reply",
    text,
    date: new Date().toISOString(),
  };
  const reply = await readReply(message, ctx, true, body.supplierName);
  return Response.json({ replies: [reply] });
}

async function readReply(m: InboxMessage, ctx: Context, pasted: boolean, supplierName?: string): Promise<ReplyItem> {
  const supplier = matchSupplier(m, ctx.suppliers, supplierName);
  const extraction = await extractReply({ subject: m.subject, body: m.text, referenceUnitPrice: ctx.referenceUnitPrice });
  const offer = buildReplyOffer(extraction, {
    key: m.id,
    supplierName: supplier?.name ?? (m.fromName || m.from || "Unknown supplier"),
    supplierEmail: m.from || supplier?.email || null,
    item: ctx.item,
    model: ctx.model,
    defaultQty: ctx.qty,
    receivedAt: m.date,
  });
  const email: EmailRecord = {
    id: `email-in-${hashString(m.id)}`,
    direction: "in",
    toFrom: m.from || (pasted ? "pasted reply" : "unknown sender"),
    subject: m.subject,
    body: m.text,
    offerId: offer?.id ?? null,
    sentAt: m.date,
    simulated: false,
    payment: paymentDetails(m.text, extraction.warningQuote ?? null),
  };
  return offer ? { email, offer } : { email, offer: null, needsOwnerInput: extraction.needsOwnerInput ?? "Price unclear." };
}

// Bank details by code (regex + IBAN checksum later); the AI only adds a quoted warning sentence the regex missed.
function paymentDetails(text: string, aiWarning: string | null) {
  const found = extractPaymentDetails(text);
  if (!found && !aiWarning) return null;
  const base = found ?? { iban: null, accountTitle: null, bankName: null, urgency: false, urgencyQuote: null };
  return aiWarning && !base.urgency ? { ...base, urgency: true, urgencyQuote: aiWarning } : base;
}

// Supplier inboxes may all be the same team test address, so names beat addresses:
// explicit choice → name in subject ("Re: RFQ for Madina …") → name in body → sender address → sender name.
function matchSupplier(m: InboxMessage, suppliers: Supplier[], chosen?: string): Supplier | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (chosen) return suppliers.find((s) => sameSupplier(s.name, chosen)) ?? { name: chosen, email: m.from, phone: null, city: null, link: null };
  const subject = norm(m.subject);
  const body = norm(m.text);
  const byName =
    suppliers.find((s) => subject.includes(norm(s.name))) ?? suppliers.find((s) => body.includes(norm(s.name)));
  if (byName) return byName;
  const byEmail = suppliers.filter((s) => m.from && s.email.toLowerCase() === m.from);
  if (byEmail.length === 1) return byEmail[0];
  return suppliers.find((s) => m.fromName && sameSupplier(s.name, m.fromName)) ?? byEmail[0] ?? null;
}

function parseSuppliers(raw: string | null): Supplier[] {
  if (raw) {
    try {
      const list = JSON.parse(raw) as Supplier[];
      if (Array.isArray(list) && list.length) return list.filter((s) => s && typeof s.name === "string");
    } catch {
      // fall through to the demo directory
    }
  }
  return resolveDemoSuppliers();
}

function positiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
