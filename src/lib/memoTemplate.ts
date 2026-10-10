// Fallback decision memo (markdown), filled only from the decision. Used when the AI is off or its
// draft fails the number check. Every number here goes through lib/format.ts, same as the facts list.
import { formatLakh, formatMonths, formatPKR, formatPct } from "./format";
import {
  MIN_SAFE_RUNWAY_MONTHS,
  findOffer,
  isFinanced,
  payDescription,
  rowYearlyRate,
  type MemoContext,
} from "./memoFacts";
import type { ComparisonRow, DecideResult, ReputationResult } from "./types";

const methodPhrases: Record<ComparisonRow["method"], string> = {
  cash: "cash at delivery",
  installments: "the supplier's installment plan",
  bank: "a bank term loan",
  ltff: "an SBP LTFF loan",
};

// Markdown comparison table, rows in the decision's order, recommended row in bold.
export function comparisonTable(decision: DecideResult): string {
  const lines = [
    "| Option | Pay | True cost before tax | True cost after tax | Runway | Verdict |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of decision.rows) {
    const cells = [
      row.label,
      payDescription(row),
      formatPKR(row.pvBeforeTax),
      formatPKR(row.pvAfterTax),
      formatMonths(row.runwayMonths),
      row.verdict,
    ];
    lines.push("| " + cells.map((c) => (row.recommended ? `**${c}**` : c)).join(" | ") + " |");
  }
  return lines.join("\n");
}

// Payment-fraud lines for the Risks section (no numbers, so they never trip the number check).
export function paymentRiskLines(context: MemoContext): string[] {
  return (context.paymentRisks ?? [])
    .filter((risk) => risk.level !== "low")
    .map((risk) =>
      risk.confirmed
        ? `- **Payment details for ${risk.supplierName}:** an email asked to change where payment goes; the owner confirmed the account by phone.`
        : `- **Payment-fraud warning (${risk.supplierName}):** an email asks for payment to different bank details. Do not pay until the account is confirmed by phone on a known number.`,
    );
}

// The AI is asked to list payment risks; if it leaves them out, code puts them under "## Risks".
export function ensurePaymentRisks(memo: string, context: MemoContext): string {
  const lines = paymentRiskLines(context);
  if (!lines.length || /fraud|payment details|bank details/i.test(memo)) return memo;
  const heading = memo.match(/^##\s*Risks?.*$/im);
  const block = lines.join("\n");
  if (!heading || heading.index === undefined) return `${memo.trimEnd()}\n\n## Risks\n${block}\n`;
  const at = heading.index + heading[0].length;
  return `${memo.slice(0, at)}\n${block}${memo.slice(at)}`;
}

export function memoTemplate(
  decision: DecideResult,
  reputations?: Record<string, ReputationResult>,
  context: MemoContext = {},
): string {
  const { rows, company } = decision;
  const rec = rows.find((r) => r.id === decision.recommendedId) ?? rows[0];
  const baseline = rows.find((r) => r.id === decision.baselineId) ?? null;
  const cashRows = rows.filter((r) => r.method === "cash");
  const cheapestCash = cashRows.length ? cashRows.reduce((a, b) => (b.pvBeforeTax < a.pvBeforeTax ? b : a)) : null;
  const nextBest = rows.find((r) => r.id !== rec.id) ?? null;
  // If LTFF falls through: the next option that is not LTFF and keeps a safe runway.
  const fallback =
    rows.find((r) => r.id !== rec.id && r.method !== "ltff" && r.runwayMonths >= MIN_SAFE_RUNWAY_MONTHS) ?? nextBest;
  const recOffer = findOffer(rec, context.offers);
  const recRate = isFinanced(rec) ? rowYearlyRate(rec, context.financing) : null;

  const out: string[] = [];
  out.push(`# Decision memo: ${company.name}`);
  out.push("");

  // Recommendation
  out.push("## Recommendation");
  const ranking =
    rec.id === rows[0].id
      ? `the lowest of the ${rows.length} ways to pay we compared`
      : `the best balance of cost and cash safety among the ${rows.length} ways to pay we compared`;
  out.push(
    `Buy from **${rec.supplierName}** with **${methodPhrases[rec.method]}** (${rec.label}), paying ${payDescription(rec)}. ` +
      `In today's money this costs **${formatPKR(rec.pvBeforeTax)}** before tax and **${formatPKR(rec.pvAfterTax)}** after tax, ` +
      `${ranking}.`,
  );
  out.push("");

  // Why
  out.push("## Why");
  if (baseline && decision.savingsVsBaseline && baseline.id !== rec.id) {
    out.push(
      `- **Saves ${formatPKR(decision.savingsVsBaseline.beforeTax)}** (${formatLakh(decision.savingsVsBaseline.beforeTax)}) ` +
        `against the original quotation's plan (${baseline.label}), and ${formatPKR(decision.savingsVsBaseline.afterTax)} even after tax.`,
    );
  } else if (nextBest) {
    out.push(
      `- After tax it costs ${formatPKR(rec.pvAfterTax)} in today's money, against ${formatPKR(nextBest.pvAfterTax)} for the next option (${nextBest.label}).`,
    );
  }
  if (baseline?.hiddenYearlyRate != null) {
    out.push(
      `- The original plan (${baseline.label}) is not free: paying ${payDescription(baseline)} instead of ${formatPKR(baseline.cashPrice)} in cash ` +
        `means a **hidden interest rate of ${formatPct(baseline.hiddenYearlyRate, 1)} a year**.`,
    );
  } else if (recRate != null && recRate < company.discountRate) {
    out.push(`- The loan rate is ${formatPct(recRate, 1)} a year, below the ${formatPct(company.discountRate, 0)} the business pays to borrow.`);
  }
  if (cheapestCash && cheapestCash.id !== rec.id) {
    out.push(
      `- **Keeps cash in the bank:** after buying, cash covers ${formatMonths(rec.runwayMonths)} of fixed costs, ` +
        `against ${formatMonths(cheapestCash.runwayMonths)} if you pay ${formatPKR(cheapestCash.upfront)} in cash (${cheapestCash.label}).`,
    );
  } else {
    out.push(`- After buying, cash still covers ${formatMonths(rec.runwayMonths)} of fixed costs.`);
  }
  out.push("");

  // Comparison
  out.push("## Comparison");
  out.push(
    `True cost is every payment brought back to today's money (discount rate ${formatPct(company.discountRate, 0)} before tax, ` +
      `${formatPct(decision.afterTaxDiscountRate, 2)} after tax). Runway is how many months of fixed costs the cash left over can pay.`,
  );
  out.push("");
  out.push(comparisonTable(decision));
  out.push("");

  // Risks
  out.push("## Risks");
  const thinRows = rows.filter((r) => r.runwayMonths < MIN_SAFE_RUNWAY_MONTHS);
  let runwayLine =
    `- **Cash runway:** today cash covers ${formatMonths(decision.runwayToday)} of fixed costs; ` +
    `with the recommended option it covers ${formatMonths(rec.runwayMonths)}. This counts no sales income, so it is a floor.`;
  if (thinRows.length) {
    runwayLine += ` These options would leave less than ${MIN_SAFE_RUNWAY_MONTHS} months: ${thinRows.map((r) => r.label).join("; ")}.`;
  }
  out.push(runwayLine);
  out.push(...paymentRiskLines(context));
  for (const rep of Object.values(reputations ?? {})) {
    if (rep.flag !== "red" && rep.flag !== "mixed") continue;
    const label = rep.flag === "red" ? "Red flags" : "Mixed reviews";
    const reasons = rep.reasons.length ? `: ${rep.reasons.join("; ")}` : "";
    out.push(`- **${label} for ${rep.supplierName}**${reasons}. Reviews do not change the money figures above.`);
  }
  if (rec.method === "ltff") {
    out.push(
      `- **LTFF approval and rate:** the ${recRate != null ? formatPct(recRate, 1) + " " : ""}rate is set by SBP and must be confirmed by the bank; ` +
        `approval takes time and needs exporter eligibility for new machinery.` +
        (fallback ? ` If LTFF is not approved, the next safe option is ${fallback.label} at ${formatPKR(fallback.pvAfterTax)} after tax.` : ""),
    );
  } else if (rec.method === "bank") {
    out.push(`- **Rate risk:** a KIBOR-linked bank rate can rise during the loan; confirm the rate and fees with the bank.`);
  }
  if (decision.breakEvenDiscountRate != null && isFinanced(rec)) {
    out.push(
      `- **Discount rate:** financing beats paying cash for any yearly discount rate above ${formatPct(decision.breakEvenDiscountRate, 2)}, ` +
        `well below the ${formatPct(company.discountRate, 0)} used here.`,
    );
  }
  for (const a of keyAssumptions(decision.assumptions)) out.push(`- Assumption: ${a}`);
  out.push("");

  // Next steps
  out.push("## Next steps");
  const steps: string[] = [];
  if (isFinanced(rec)) {
    const facility = rec.method === "ltff" ? "an LTFF" : "a bank term-loan";
    steps.push(`Request ${facility} term sheet from the bank: exact rate today, processing fees, collateral, insurance and approval time.`);
    if (rec.method === "ltff") {
      steps.push("Confirm LTFF eligibility with the bank and prepare the documents (export registration, quotation for new machinery).");
    }
  }
  const priceNote = recOffer ? ` at ${formatPKR(recOffer.unitPrice)} per machine` : "";
  steps.push(`Negotiate with ${rec.supplierName}: confirm the price${priceNote}, delivery and warranty in writing.`);
  steps.push(
    `Keep runway at or above ${MIN_SAFE_RUNWAY_MONTHS} months: avoid paying the full price in cash, and recheck cash before each payment.`,
  );
  steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
  out.push("");
  out.push("_Every number in this memo comes from Faisla's calculation, not from AI._");

  return out.join("\n");
}

// A one-page memo keeps the assumptions an owner acts on (fees, collateral, LTFF, stress); the full
// list stays on the Assumptions card. Falls back to every assumption if none match.
function keyAssumptions(assumptions: string[]): string[] {
  const key = assumptions.filter((a) => /fee|insurance|collateral|LTFF|stress/i.test(a));
  return key.length ? key : assumptions;
}
