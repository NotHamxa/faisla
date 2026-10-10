// The only numbers the memo may use, preformatted by code. The memo prompt, the fallback template
// and the number check all read from this list, so a number is either here or it is rejected.
import { SAFE_RUNWAY } from "./finance";
import { formatLakh, formatMonths, formatPKR, formatPct, groupPKR } from "./format";
import { extractNumbers } from "./numberCheck";
import type { ComparisonRow, DecideResult, FinancingOption, Offer, ReputationResult } from "./types";

export type MemoFact = {
  key: string; // stable id, e.g. "row.offer-b:ltff.pvBeforeTax"
  label: string; // what the number means, in plain English
  value: string; // display string to copy exactly, e.g. "Rs 49,87,935"
  alt?: string[]; // other allowed spellings, e.g. ["49.9 lakh"]
};

export type MemoContext = {
  offers?: Offer[];
  financing?: FinancingOption[];
};

// Runway the recommendation must keep (same rule as the finance engine), used in risks and next steps.
export const MIN_SAFE_RUNWAY_MONTHS = SAFE_RUNWAY;

const methodNames: Record<ComparisonRow["method"], string> = {
  cash: "cash",
  installments: "supplier installments",
  bank: "bank term loan",
  ltff: "SBP LTFF loan",
};

export function methodName(row: ComparisonRow): string {
  return methodNames[row.method];
}

export function isFinanced(row: ComparisonRow): boolean {
  return row.method === "bank" || row.method === "ltff";
}

function money(value: number): { value: string; alt: string[] } {
  return { value: formatPKR(value), alt: [groupPKR(value), formatLakh(value)] };
}

// "Show calculation" inputs may be numbers or display strings ("Rs 48,24,000", "8.5%").
function calcInput(row: ComparisonRow, keyPattern: RegExp): number | string | null {
  for (const step of row.calculation) {
    for (const [key, input] of Object.entries(step.inputs)) if (keyPattern.test(key)) return input;
  }
  return null;
}

function parseRate(input: number | string | null): number | null {
  if (typeof input === "number") return input > 0 && input < 1 ? input : null;
  const m = input?.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) / 100 : null;
}

function parseAmount(input: number | string | null): number | null {
  if (typeof input === "number") return input;
  const m = input?.match(/\d[\d,]*(?:\.\d+)?/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

// Yearly loan rate of a financed row. The row label and calculation carry any KIBOR stress shift,
// so they win over the (unshifted) financing table.
export function rowYearlyRate(row: ComparisonRow, financing?: FinancingOption[]): number | null {
  return (
    parseRate(calcInput(row, /^(yearly ?rate|annual ?rate|yearlyRate|annualRate)$/i)) ??
    parseRate(row.label) ??
    financing?.find((f) => f.id === row.financingId)?.annualRate ??
    null
  );
}

// Loan principal: "show calculation" input (P / principal), else the financing's down-payment share,
// else cash price less the upfront payment (exact when there is no processing fee).
export function rowPrincipal(row: ComparisonRow, financing?: FinancingOption[]): number {
  const fromCalc = parseAmount(calcInput(row, /^(p|principal)$/i));
  if (fromCalc != null) return fromCalc;
  const option = financing?.find((f) => f.id === row.financingId);
  if (option) return row.cashPrice * (1 - option.downPaymentPct);
  return row.cashPrice - row.upfront;
}

// "Rs 5,36,000 + 36 × Rs 1,52,282", "12 × Rs 5,00,000", "Rs 53,60,000 now".
export function payDescription(row: ComparisonRow): string {
  if (row.months <= 0) return `${formatPKR(row.upfront)} now`;
  const plan = `${row.months} × ${formatPKR(row.monthlyPayment)}`;
  return row.upfront > 0 ? `${formatPKR(row.upfront)} + ${plan}` : plan;
}

export function findOffer(row: ComparisonRow, offers?: Offer[]): Offer | undefined {
  return offers?.find((o) => o.id === row.offerId);
}

export function memoFacts(
  decision: DecideResult,
  reputations?: Record<string, ReputationResult>,
  context: MemoContext = {},
): MemoFact[] {
  const facts: MemoFact[] = [];
  const add = (key: string, label: string, value: string, alt?: string[]) =>
    facts.push(alt?.length ? { key, label, value, alt } : { key, label, value });
  const addMoney = (key: string, label: string, amount: number) => {
    const m = money(amount);
    add(key, label, m.value, m.alt);
  };

  const { company, rows } = decision;
  const recommended = rows.find((r) => r.id === decision.recommendedId) ?? rows[0];
  const baseline = rows.find((r) => r.id === decision.baselineId) ?? null;

  // Company
  add("company.name", "Company", company.name);
  add("company.city", "City", company.city);
  add("company.exporter", "Exporter", company.isExporter ? "yes" : "no");
  addMoney("company.cash", "Cash in bank today", company.cashBalance);
  addMoney("company.fixedCosts", "Monthly fixed costs (salaries, rent, utilities)", company.monthlyFixedCosts);
  add("company.taxRate", "Tax rate", formatPct(company.taxRate, 0));
  add("company.discountRate", "Discount rate before tax (about the bank borrowing rate)", formatPct(company.discountRate, 0));
  add("company.afterTaxDiscountRate", "Discount rate after tax", formatPct(decision.afterTaxDiscountRate, 2));

  // Purchase, per supplier offer used in the comparison
  const offerIds = [...new Set(rows.map((r) => r.offerId))];
  for (const offerId of offerIds) {
    const offer = context.offers?.find((o) => o.id === offerId);
    const supplier = rows.find((r) => r.offerId === offerId)?.supplierName ?? offerId;
    if (!offer) continue;
    const prefix = `offer.${offerId}`;
    add(`${prefix}.supplier`, "Supplier", supplier);
    add(`${prefix}.item`, `Item quoted by ${supplier}`, offer.model ? `${offer.item} (${offer.model})` : offer.item);
    add(`${prefix}.qty`, `Machines quoted by ${supplier}`, String(offer.qty));
    addMoney(`${prefix}.unitPrice`, `Price per machine from ${supplier}`, offer.unitPrice);
    addMoney(`${prefix}.total`, `List total from ${supplier}`, offer.total);
    if (offer.cashDiscountPct) add(`${prefix}.cashDiscount`, `Cash discount from ${supplier}`, `${offer.cashDiscountPct}%`);
    if (offer.deliveryDays) add(`${prefix}.delivery`, `Delivery time from ${supplier}`, `${offer.deliveryDays} days`);
    if (offer.warrantyMonths) add(`${prefix}.warranty`, `Warranty from ${supplier}`, `${offer.warrantyMonths} months`);
  }

  // Headline
  add("recommended.option", "Recommended option", recommended.label);
  add("recommended.supplier", "Recommended supplier", recommended.supplierName);
  add("recommended.method", "Recommended way to pay", methodName(recommended));
  if (baseline && decision.savingsVsBaseline) {
    add("baseline.option", "Original quotation's plan (baseline)", baseline.label);
    addMoney("savings.beforeTax", `Saving vs ${baseline.label}, before tax, in today's money`, decision.savingsVsBaseline.beforeTax);
    addMoney("savings.afterTax", `Saving vs ${baseline.label}, after tax, in today's money`, decision.savingsVsBaseline.afterTax);
  }
  add("runway.today", "Runway today without the purchase (months of fixed costs covered by cash)", formatMonths(decision.runwayToday));
  add("runway.minimum", "Minimum safe runway (owner's rule of thumb)", `${MIN_SAFE_RUNWAY_MONTHS} months`);
  if (decision.breakEvenDiscountRate != null) {
    add(
      "breakEven",
      `${recommended.label} beats paying cash for any yearly discount rate above`,
      formatPct(decision.breakEvenDiscountRate, 2),
      [formatPct(decision.breakEvenDiscountRate, 1)],
    );
  }
  if (decision.kiborShift) {
    add("kiborShift", "Stress test: KIBOR shift applied to bank loans", `+${formatPct(decision.kiborShift, 1)}`);
  }
  add("count.options", "Ways to pay compared", String(rows.length));
  add("count.suppliers", "Suppliers compared", String(offerIds.length));

  // Comparison rows (in table order)
  for (const row of rows) {
    const p = `row.${row.id}`;
    add(`${p}.option`, "Option", row.label);
    add(`${p}.pay`, `${row.label}: how it is paid`, payDescription(row));
    addMoney(`${p}.cashPrice`, `${row.label}: cash price of the machines`, row.cashPrice);
    if (row.months > 0) {
      if (row.upfront > 0) addMoney(`${p}.upfront`, `${row.label}: paid at delivery`, row.upfront);
      addMoney(`${p}.monthly`, `${row.label}: monthly payment`, row.monthlyPayment);
      add(`${p}.months`, `${row.label}: number of monthly payments`, String(row.months));
      addMoney(`${p}.totalPaid`, `${row.label}: total paid over time`, row.totalPaid);
    }
    if (isFinanced(row)) {
      const rate = rowYearlyRate(row, context.financing);
      if (rate != null) add(`${p}.rate`, `${row.label}: yearly loan rate`, formatPct(rate, 1));
      const principal = rowPrincipal(row, context.financing);
      addMoney(`${p}.principal`, `${row.label}: loan amount`, principal);
      if (row.cashPrice > 0 && principal < row.cashPrice) {
        addMoney(`${p}.down`, `${row.label}: down payment`, row.cashPrice - principal);
        add(`${p}.downPct`, `${row.label}: down payment share`, formatPct(1 - principal / row.cashPrice, 0));
      }
    }
    addMoney(`${p}.pvBeforeTax`, `${row.label}: true cost in today's money, before tax`, row.pvBeforeTax);
    addMoney(`${p}.pvAfterTax`, `${row.label}: true cost in today's money, after tax`, row.pvAfterTax);
    add(`${p}.runway`, `${row.label}: runway after buying (months of fixed costs covered by cash)`, formatMonths(row.runwayMonths));
    if (row.hiddenYearlyRate != null) {
      add(`${p}.hiddenRate`, `${row.label}: hidden interest rate a year`, formatPct(row.hiddenYearlyRate, 1));
    }
    if (row.hiddenSimpleRate != null) {
      add(`${p}.hiddenSimpleRate`, `${row.label}: hidden rate as a simple yearly quote`, formatPct(row.hiddenSimpleRate, 1));
    }
    add(`${p}.verdict`, `${row.label}: verdict`, row.verdict);
  }

  // Reputation (red flags are risks, they do not change the money figures)
  for (const rep of Object.values(reputations ?? {})) {
    const p = `reputation.${rep.supplierName}`;
    add(`${p}.flag`, `Reviews of ${rep.supplierName}${rep.model ? ` / ${rep.model}` : ""}`, rep.flag.replace("_", " "));
    if (rep.averageRating != null) {
      add(`${p}.rating`, `Average review rating of ${rep.supplierName}`, `${rep.averageRating.toFixed(1)} out of 5`);
    }
    add(`${p}.count`, `Reviews read for ${rep.supplierName}`, String(rep.reviews.length));
    rep.reasons.forEach((reason, i) => add(`${p}.reason${i}`, `Review finding for ${rep.supplierName}`, reason));
  }

  // Assumptions written by the finance engine
  decision.assumptions.forEach((a, i) => add(`assumption.${i}`, "Assumption", a));

  return facts;
}

// Every normalised number that appears in a fact's display strings or label.
export function allowedNumbers(facts: MemoFact[]): Set<string> {
  const allowed = new Set<string>();
  for (const fact of facts) {
    for (const text of [fact.label, fact.value, ...(fact.alt ?? [])]) {
      for (const token of extractNumbers(text)) allowed.add(token.normalized);
    }
  }
  return allowed;
}
