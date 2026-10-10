// POST /api/bank-email: chosen financing row → term-sheet request to the bank's SME desk (a test inbox).
// Islamic rows go to an Islamic bank's SME desk and ask Islamic-finance questions (profit rate, takaful, security
// deposit, late-payment charity undertaking, Shariah board approval). The body is a code template: every number
// comes from the decision, none from AI.
import { apiUser } from "@/lib/auth/api";
import { sendEmail } from "@/lib/email";
import { FINANCING_NAMES, amortisation, isShariahRow } from "@/lib/finance";
import { formatPKR, formatPct, groupPKR } from "@/lib/format";
import { financeTerms, findOffer, isFinanced, rowPrincipal, rowYearlyRate } from "@/lib/memoFacts";
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
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
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

  // The chosen row; if it is not financing (cash / deferred-price plan), ask about the best Shariah-compliant
  // financing row instead (rows are sorted by after-tax cost), then any financing row.
  const chosen =
    decision.rows.find((r) => r.id === (body.rowId ?? decision.recommendedId)) ??
    decision.rows.find((r) => r.recommended) ??
    decision.rows[0];
  const row = isFinanced(chosen)
    ? chosen
    : (decision.rows.find((r) => isFinanced(r) && isShariahRow(r)) ?? decision.rows.find(isFinanced) ?? chosen);

  const to = process.env.BANK_INBOX || process.env.TEST_INBOX || process.env.GMAIL_USER || "sme-desk@bank.example";
  const offer = findOffer(row, body.offers);
  const { subject, text } = buildEmail(row, company, offer, body.financing);

  let attachment: BankEmailResponse["attachment"] = null;
  if (isFinanced(row) && row.months > 0) {
    attachment = {
      filename: row.method === "ijarah" ? "rental-schedule.txt" : isShariahRow(row) ? "installment-schedule.txt" : "repayment-schedule.txt",
      content: buildSchedule(row, company, body.financing),
    };
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
  const configured = financing?.find((f) => f.id === row.financingId)?.name;
  if (row.method === "iltf") return "SBP Islamic Long-Term Financing Facility (ILTFF) through Diminishing Musharakah";
  if (row.method === "ltff") return "SBP Long-Term Financing Facility (LTFF), conventional";
  if (row.method === "diminishing_musharakah" || row.method === "murabaha" || row.method === "ijarah") {
    return configured ?? `${FINANCING_NAMES[row.method]} (Islamic)`;
  }
  if (row.method === "bank") return configured ?? "Term loan";
  return "Machinery financing";
}

function shortFacility(row: ComparisonRow): string {
  if (row.method === "iltf") return "Islamic LTFF (Diminishing Musharakah)";
  if (row.method === "ltff") return "SBP LTFF";
  if (row.method === "bank") return "term loan";
  if (row.method === "diminishing_musharakah" || row.method === "murabaha" || row.method === "ijarah") return FINANCING_NAMES[row.method];
  return "financing";
}

function buildEmail(row: ComparisonRow, company: Company, offer: Offer | undefined, financing?: FinancingOption[]) {
  const financed = isFinanced(row);
  const islamic = financed && isShariahRow(row);
  const terms = financed ? financeTerms(row) : null;
  const rate = financed ? rowYearlyRate(row, financing) : null;
  const principal = financed ? rowPrincipal(row, financing) : row.cashPrice;
  const down = row.cashPrice - principal;
  const item = offer ? `${offer.item}${offer.model ? ` (${offer.model})` : ""}` : "machinery";
  const what = offer ? `${offer.qty} × ${item}` : item;
  const facility = facilityName(row, financing);
  const ijarah = row.method === "ijarah";
  const sbp = row.method === "iltf" || row.method === "ltff";

  const subject = `Term sheet request: ${shortFacility(row)} for ${offer ? `${offer.qty} machines` : "new machinery"} – ${company.name}`;

  const requested = islamic
    ? [
        `- Facility: ${facility}`,
        ...(rate != null ? [`- Indicative ${ijarah ? "rental rate" : "profit rate"}: ${formatPct(rate)} a year`] : []),
        `- ${ijarah ? "Bank's cost to be recovered through rentals" : row.method === "murabaha" ? "Amount financed" : "Bank's share to be financed"}: ${formatPKR(principal)}`,
        ...(row.months > 0 ? [`- Tenor: ${row.months} months`] : []),
        ...(down > 0 ? [`- ${ijarah ? "Security deposit" : "Our share"}: ${formatPKR(down)} (${formatPct(down / row.cashPrice, 0)})`] : []),
        ...(row.months > 0
          ? [`- Indicative monthly ${ijarah ? "rental" : "installment"}: ${formatPKR(row.monthlyPayment)} (schedule attached)`]
          : []),
      ]
    : [
        `- Facility: ${facility}`,
        ...(rate != null ? [`- Indicative rate: ${formatPct(rate)} a year`] : []),
        `- ${terms?.principal ? terms.principal.charAt(0).toUpperCase() + terms.principal.slice(1) : "Amount"}: ${formatPKR(principal)}`,
        ...(row.months > 0 ? [`- Tenor: ${row.months} months`] : []),
        ...(down > 0 ? [`- Down payment: ${formatPKR(down)} (${formatPct(down / row.cashPrice, 0)})`] : []),
        ...(financed && row.months > 0
          ? [`- Indicative monthly installment: ${formatPKR(row.monthlyPayment)} (repayment schedule attached)`]
          : []),
      ];

  const questions = islamic
    ? [
        `What ${ijarah ? "rental rate" : "profit rate"} can you offer today, and what is the benchmark (KIBOR tenor + spread, or the SBP rate) and repricing frequency?`,
        ijarah
          ? "What security deposit is required, and is it adjusted against the purchase price when ownership transfers at the end?"
          : row.method === "murabaha"
            ? "Is the deferred sale price fixed at the contract, and what advance do you need from us?"
            : "What share of the machines must we hold at the start, and how often do we purchase the bank's units?",
        "What takaful is required on the machines, who arranges it, and at what cost?",
        "What processing fees and other charges apply, and what collateral or security is required?",
        "Please confirm the late-payment terms: a charity undertaking only (not bank income) and no compounding.",
        "Has your Shariah board approved this product? Please share the approval or fatwa reference.",
        "How long do approval and disbursement usually take?",
        ...(sbp || company.isExporter
          ? ["Which documents do you need to confirm Islamic LTFF eligibility (export registration, quotation for new machinery, other)?"]
          : []),
      ]
    : [
        "What exact rate can you offer today for this facility?",
        "What processing fees and other charges apply?",
        "What collateral or security is required?",
        "What insurance is required, and at what cost?",
        "How long do approval and disbursement usually take?",
        ...(sbp || company.isExporter
          ? ["Which documents do you need to confirm LTFF eligibility (export registration, machinery quotation, other)?"]
          : []),
      ];

  const lines = [
    islamic ? "Dear Islamic Banking SME team," : "Dear SME Banking team,",
    "",
    `${company.name}${company.isExporter ? ", an exporter" : ""} based in ${company.city}, plans to buy ${what} from ${row.supplierName}. ` +
      (islamic
        ? "We would like Shariah-compliant financing and request a term sheet for the facility below."
        : "We would like a term sheet for the financing below."),
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
    ...requested,
    "",
    "Questions",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
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

// Fixed-width text table (rounded rupees). Islamic: installment = rent/profit on the bank's outstanding share + share
// purchase; Ijarah: rental with its profit and cost parts. Conventional: payment, markup, principal, balance.
function buildSchedule(row: ComparisonRow, company: Company, financing?: FinancingOption[]): string {
  const rate = rowYearlyRate(row, financing) ?? 0;
  const principal = rowPrincipal(row, financing);
  const schedule = amortisation(principal, rate, row.months);
  const islamic = isShariahRow(row);
  const ijarah = row.method === "ijarah";
  const dm = row.method === "diminishing_musharakah" || row.method === "iltf";
  const cols = ijarah
    ? ["Month", "Rental", "Profit part", "Cost part", "Unrecovered"]
    : dm
      ? ["Month", "Installment", "Rent", "Units bought", "Bank share"]
      : islamic
        ? ["Month", "Installment", "Profit", "Cost", "Outstanding"]
        : ["Month", "Payment", "Markup", "Principal", "Balance"];
  const widths = [5, 12, 12, 12, 13];
  const fmt = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i])).join("  ");
  const totals = schedule.reduce(
    (t, r) => ({ payment: t.payment + r.payment, markup: t.markup + r.markup, principal: t.principal + r.principalPaid }),
    { payment: 0, markup: 0, principal: 0 },
  );
  const header = islamic
    ? `${facilityName(row, financing)}: ${ijarah ? "bank's cost" : "amount financed"} ${formatPKR(principal)}, ${formatPct(rate)} a year ${ijarah ? "rental rate" : "profit rate"}, ${row.months} months`
    : `${facilityName(row, financing)}: loan ${formatPKR(principal)}, ${formatPct(rate)} a year, ${row.months} months`;
  const note = ijarah
    ? "Rental = profit part (outstanding cost × rate ÷ 12) + cost part. The security deposit is adjusted against the purchase price at the end. Amounts in PKR, rounded. Indicative until confirmed by the bank."
    : dm
      ? "Rent = bank's remaining share × profit rate ÷ 12; the rest buys the bank's units. Never compounded; late payment goes to charity. Amounts in PKR, rounded. Indicative until confirmed by the bank."
      : islamic
        ? "Profit = outstanding cost × profit rate ÷ 12; the deferred price is fixed at the contract. Amounts in PKR, rounded. Indicative until confirmed by the bank."
        : "Markup = balance × yearly rate ÷ 12. Amounts in PKR, rounded. Indicative until confirmed by the bank.";
  const out = [
    `${ijarah ? "Rental" : islamic ? "Installment" : "Repayment"} schedule – ${company.name}`,
    header,
    note,
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
