// POST { supplier, item, model, qty, company } → { email: EmailRecord, error? }.
// AI writes the RFQ (spec §7.4, template if AI is unavailable); lib/email sends it to a test inbox.
// The subject names the supplier so their "Re:" reply can be matched back to them.
import { apiUser } from "@/lib/auth/api";
import { aiText } from "@/lib/ai";
import { DEMO_ITEM, DEMO_MODEL, demoCompany } from "@/lib/demoData";
import { sendEmail } from "@/lib/email";
import type { EmailRecord, Supplier } from "@/lib/types";

export const maxDuration = 30;

type Body = {
  supplier?: Supplier;
  item?: string;
  model?: string | null;
  qty?: number;
  company?: { name?: string; city?: string } | string;
};

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const body = (await request.json().catch(() => ({}))) as Body;
  const supplier = body.supplier;
  if (!supplier?.name || !supplier.email) {
    return Response.json({ needsOwnerInput: true, reason: "Supplier name and email required" }, { status: 400 });
  }
  const item = body.item || DEMO_ITEM;
  const model = body.model || DEMO_MODEL;
  const qty = body.qty && body.qty > 0 ? Math.round(body.qty) : 1;
  const companyName =
    (typeof body.company === "string" ? body.company : body.company?.name) || process.env.COMPANY_NAME || demoCompany.name;
  const city = (typeof body.company === "object" ? body.company?.city : null) || demoCompany.city;

  const subject = `RFQ for ${supplier.name}: ${qty} x ${model} - ${companyName}`;
  const aiBody = await aiText({
    system:
      "You write short business emails for a Pakistani SME. Output only the email body: no subject line, no placeholders in brackets.",
    prompt:
      `Write a short, polite request for quotation from ${companyName} in ${city} to ${supplier.name} for ${qty} × ${model} (${item}), ` +
      "asking for unit price, delivery time, warranty, and cash vs installment terms. Plain English, under 120 words. " +
      `Sign off as "Procurement, ${companyName}, ${city}".`,
    maxTokens: 600,
  });
  const text = cleanBody(aiBody) ?? templateRfq({ supplierName: supplier.name, companyName, city, qty, model, item });

  const result = await sendEmail({ to: supplier.email, subject, text });
  const email: EmailRecord = {
    id: result.id,
    direction: "out",
    toFrom: supplier.email,
    subject,
    body: text,
    offerId: null,
    sentAt: new Date().toISOString(),
    simulated: !result.sent,
  };
  return Response.json({ email, ...(result.error ? { error: result.error } : {}) });
}

function cleanBody(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text.replace(/^subject:.*\n+/i, "").trim();
  return cleaned.length > 20 ? cleaned : null;
}

function templateRfq(p: { supplierName: string; companyName: string; city: string; qty: number; model: string; item: string }) {
  return [
    `Dear ${p.supplierName} team,`,
    "",
    `${p.companyName} (${p.city}) is planning to buy ${p.qty} × ${p.model} (${p.item}).`,
    "Please send your best quotation with:",
    "- unit price (PKR) and total",
    "- delivery time to our factory",
    "- warranty period",
    "- cash price and any installment terms",
    "",
    "A reply to this email is fine. Thank you.",
    "",
    `Procurement, ${p.companyName}, ${p.city}`,
  ].join("\n");
}
