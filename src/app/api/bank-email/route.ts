// POST /api/bank-email: chosen financing row → term-sheet request to the bank's SME desk (a test inbox).
// The body is a code template: every number comes from the decision, none from AI.
import { sendEmail } from "@/lib/email";
import { amortisation } from "@/lib/finance";
import { formatPKR, formatPct, groupPKR } from "@/lib/format";
import { findOffer, isFinanced, rowPrincipal, rowYearlyRate } from "@/lib/memoFacts";
import type { Company, ComparisonRow, DecideResult, EmailRecord, FinancingOption, Offer } from "@/lib/types";

type BankEmailRequest = {
  decision: DecideResult;
  company: Company;
  rowId?: string; // defaults to the recommended row
  offers?: Offer[]; // optional: qty, item and unit price for the purchase section
  financing?: FinancingOption[]; // optional: facility names
};

type BankEmailResponse = {
  email: EmailRecord;
  attachment: { filename: string; content: string } | null;
  error?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: BankEmailRequest;
  try {
    body = (await request.json()) as BankEmailRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { decision, company } = body;
  if (!decision?.rows?.length || !company) {
    return Response.json({ error: "decision and company are required" }, { status: 400 });
  }

  // The chosen row; if it is not a loan (cash/installments), ask about the best loan row instead.
  const chosen =
    decision.rows.find((r) => r.id === (body.rowId ?? decision.recommendedId)) ??
    decision.rows.find((r) => r.recommended) ??
    decision.rows[0];
  const row = isFinanced(chosen) ? chosen : (decision.rows.find(isFinanced) ?? chosen);

  const to = process.env.BANK_INBOX || process.env.TEST_INBOX || process.env.GMAIL_USER || "sme-desk@bank.example";
  const offer = findOffer(row, body.offers);
  const { subject, text } = buildEmail(row, company, offer, body.financing);

  let attachment: BankEmailResponse["attachment"] = null;
  if (isFinanced(row) && row.months > 0) {
    attachment = { filename: "repayment-schedule.txt", content: buildSchedule(row, company, body.financing) };
  }

  const result = await sendEmail({
    to,
    subject,
    text,
    attachments: attachment ? [{ ...attachment, contentType: "text/plain" }] : undefined,
  });

  const email: EmailRecord = {
    id: result.id,
    direction: "out",
    toFrom: to,
    subject,
    body: text,
    offerId: row.offerId,
    sentAt: new Date().toISOString(),
    simulated: result.simulated,
  };
  const response: BankEmailResponse = { email, attachment, ...(result.error ? { error: result.error } : {}) };
  return Response.json(response);
}

function facilityName(row: ComparisonRow, financing?: FinancingOption[]): string {
  if (row.method === "ltff") return "SBP Long-Term Financing Facility (LTFF)";
  if (row.method === "bank") return financing?.find((f) => f.id === row.financingId)?.name ?? "Term loan";
  return "Machinery financing";
}

function buildEmail(row: ComparisonRow, company: Company, offer: Offer | undefined, financing?: FinancingOption[]) {
  const financed = isFinanced(row);
  const rate = financed ? rowYearlyRate(row, financing) : null;
  const principal = financed ? rowPrincipal(row, financing) : row.cashPrice;
  const down = row.cashPrice - principal;
  const item = offer ? `${offer.item}${offer.model ? ` (${offer.model})` : ""}` : "machinery";
  const what = offer ? `${offer.qty} × ${item}` : item;
  const facility = facilityName(row, financing);
  const short = row.method === "ltff" ? "SBP LTFF" : row.method === "bank" ? "term loan" : "financing";

  const subject = `Term sheet request: ${short} for ${offer ? `${offer.qty} machines` : "new machinery"} – ${company.name}`;

  const lines = [
    "Dear SME Banking team,",
    "",
    `${company.name}${company.isExporter ? ", an exporter" : ""} based in ${company.city}, plans to buy ${what} from ${row.supplierName}. ` +
      `We would like a term sheet for the financing below.`,
    "",
    "Company",
    `- Name: ${company.name}`,
    `- City: ${company.city}`,
    `- Exporter: ${company.isExporter ? "yes" : "no"}`,
    "",
    "Purchase",
    `- Supplier: ${row.supplierName}`,
    `- Item: ${what}`,
    ...(offer ? [`- Price per machine: ${formatPKR(offer.unitPrice)}`] : []),
    `- Purchase price: ${formatPKR(row.cashPrice)}`,
    "",
    "Requested facility",
    `- Facility: ${facility}`,
    ...(rate != null ? [`- Indicative rate: ${formatPct(rate)} a year`] : []),
    `- Loan amount: ${formatPKR(principal)}`,
    ...(row.months > 0 ? [`- Tenor: ${row.months} months`] : []),
    ...(down > 0 ? [`- Down payment: ${formatPKR(down)} (${formatPct(down / row.cashPrice, 0)})`] : []),
    ...(financed && row.months > 0
      ? [`- Indicative monthly payment: ${formatPKR(row.monthlyPayment)} (repayment schedule attached)`]
      : []),
    "",
    "Questions",
    "1. What exact rate can you offer today for this facility?",
    "2. What processing fees and other charges apply?",
    "3. What collateral or security is required?",
    "4. What insurance is required, and at what cost?",
    "5. How long do approval and disbursement usually take?",
    ...(row.method === "ltff" || company.isExporter
      ? ["6. Which documents do you need to confirm LTFF eligibility (export registration, machinery quotation, other)?"]
      : []),
    "",
    "Thank you. We look forward to your term sheet.",
    "",
    "Regards,",
    company.name,
    company.city,
    "",
    "(Prepared with Faisla. Figures are our own calculation and indicative until confirmed by the bank.)",
  ];
  return { subject, text: lines.join("\n") };
}

// Fixed-width text table: month, payment, markup, principal, balance (rounded rupees).
function buildSchedule(row: ComparisonRow, company: Company, financing?: FinancingOption[]): string {
  const rate = rowYearlyRate(row, financing) ?? 0;
  const principal = rowPrincipal(row, financing);
  const schedule = amortisation(principal, rate, row.months);
  const cols = ["Month", "Payment", "Markup", "Principal", "Balance"];
  const widths = [5, 12, 12, 12, 13];
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i])).join("  ");
  const totals = schedule.reduce(
    (t, r) => ({ payment: t.payment + r.payment, markup: t.markup + r.markup, principal: t.principal + r.principalPaid }),
    { payment: 0, markup: 0, principal: 0 },
  );
  const out = [
    `Repayment schedule – ${company.name}`,
    `${facilityName(row, financing)}: loan ${formatPKR(principal)}, ${formatPct(rate)} a year, ${row.months} months`,
    "Markup = balance × yearly rate ÷ 12. Amounts in PKR, rounded. Indicative until confirmed by the bank.",
    "",
    fmt(cols),
    fmt(widths.map((w) => "-".repeat(w))),
    ...schedule.map((r) =>
      fmt([String(r.month), groupPKR(r.payment), groupPKR(r.markup), groupPKR(r.principalPaid), groupPKR(Math.max(0, r.balance))]),
    ),
    fmt(widths.map((w) => "-".repeat(w))),
    fmt(["Total", groupPKR(totals.payment), groupPKR(totals.markup), groupPKR(totals.principal), ""]),
  ];
  return out.join("\n");
}
