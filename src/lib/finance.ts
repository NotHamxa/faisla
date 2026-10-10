// Faisla finance engine (TECHNICAL_SPEC.md §4). Pure maths: no AI, no I/O.
// Faithful port of reference/finance_reference.py — every number on screen comes from here.
// Islamic finance first (docs/ISLAMIC_FINANCE.md): Shariah-compliant financing is compared by default; conventional
// (interest-based) rows appear only when the company's preference is "both", and are never recommended.
import { formatPKR, formatPct } from "./format";
import type {
  CalculationStep,
  Company,
  ComparisonRow,
  DecideInput,
  DecideResult,
  FinancingOption,
  FinancingPreference,
  FinancingType,
  Offer,
  PaymentMethod,
} from "./types";

export type Flow = { month: number; amount: number }; // positive = cash out

export type DepreciationOpts = { initialAllowance: number; rate: number; lifeYears: number };
export const DEPRECIATION: DepreciationOpts = { initialAllowance: 0.25, rate: 0.15, lifeYears: 10 };

export const SAFE_RUNWAY = 2; // months of fixed costs the recommended option must leave
export const SALARIES_AT_RISK_RUNWAY = 1.5;

// ---------- rates ----------

export function monthlyFromYearly(yearly: number): number {
  return (1 + yearly) ** (1 / 12) - 1;
}

export function yearlyFromMonthly(monthly: number): number {
  return (1 + monthly) ** 12 - 1;
}

// Monthly r with cashPrice = Σ installment / (1 + r)^t, t = 1…n (or 0…n−1 if due on delivery).
export function hiddenMonthlyRate(
  cashPrice: number,
  installment: number,
  months: number,
  firstDueOnDelivery: boolean,
): number {
  if (installment * months <= cashPrice) return 0;
  const start = firstDueOnDelivery ? 0 : 1;
  const pvAt = (r: number) => {
    let sum = 0;
    for (let t = start; t < start + months; t++) sum += installment / (1 + r) ** t;
    return sum;
  };
  let lo = 0;
  let hi = 0.2;
  let r = 0;
  for (let k = 0; k < 200; k++) {
    r = (lo + hi) / 2;
    if (pvAt(r) > cashPrice) lo = r;
    else hi = r;
  }
  return r;
}

// ---------- installment schedule (financing) ----------

// Equal monthly installment on an amount financed, bank convention i = yearlyRate / 12. Islamic modes use the same
// schedule: Diminishing Musharakah = rent on the bank's remaining share + purchase of its units; Murabaha / Islamic LTFF
// = equal installments of a price fixed at the contract; Ijarah = rentals that recover the bank's cost net of the
// security deposit. Profit accrues on the outstanding amount only, never compounded on late payments.
export function emi(principal: number, yearlyRate: number, months: number): number {
  if (months <= 0) return principal;
  const i = yearlyRate / 12;
  if (i === 0) return principal / months;
  const f = (1 + i) ** months;
  return (principal * i * f) / (f - 1);
}

export type AmortisationRow = {
  month: number;
  payment: number;
  markup: number;
  principalPaid: number;
  balance: number;
};

export function amortisation(principal: number, yearlyRate: number, months: number): AmortisationRow[] {
  const payment = emi(principal, yearlyRate, months);
  const rows: AmortisationRow[] = [];
  let balance = principal;
  for (let m = 1; m <= months; m++) {
    const markup = (balance * yearlyRate) / 12;
    const principalPaid = payment - markup;
    balance -= principalPaid;
    rows.push({ month: m, payment, markup, principalPaid, balance });
  }
  return rows;
}

// ---------- present value & tax ----------

export function presentValue(flows: Flow[], yearlyDiscountRate: number): number {
  const d = monthlyFromYearly(yearlyDiscountRate);
  return flows.reduce((sum, f) => sum + f.amount / (1 + d) ** f.month, 0);
}

// 25% initial allowance in year 1, then reducing balance (incl. year 1 on cost less the allowance),
// remainder written off in the final year.
export function taxDepreciation(cost: number, opts: DepreciationOpts = DEPRECIATION): number[] {
  const out: number[] = [];
  let wdv = cost;
  for (let y = 1; y <= opts.lifeYears; y++) {
    let d = 0;
    if (y === 1) {
      const ia = cost * opts.initialAllowance;
      d += ia;
      wdv -= ia;
    }
    if (y === opts.lifeYears) {
      d += wdv;
      wdv = 0;
    } else {
      const nd = wdv * opts.rate;
      d += nd;
      wdv -= nd;
    }
    out.push(d);
  }
  return out;
}

// Ijarah: the lessee claims no depreciation during the lease. After ownership transfers (by a separate sale at the end),
// the purchase price is depreciated from the next tax year at the normal 15% reducing balance; no initial allowance
// (the machine has already been used in Pakistan). Remainder written off in the final year of the same 10-year horizon.
export function postTransferDepreciation(
  purchasePrice: number,
  tenorMonths: number,
  opts: DepreciationOpts = DEPRECIATION,
): number[] {
  const out = new Array<number>(opts.lifeYears).fill(0);
  if (purchasePrice <= 0) return out;
  const startYear = Math.min(Math.floor(tenorMonths / 12) + 1, opts.lifeYears);
  let wdv = purchasePrice;
  for (let y = startYear; y <= opts.lifeYears; y++) {
    const d = y === opts.lifeYears ? wdv : wdv * opts.rate;
    out[y - 1] = d;
    wdv -= d;
  }
  return out;
}

// Tax saved in year y = (deductible finance cost_y + depreciation_y) × taxRate, received at month 12y (as negative
// cash out). Deductible finance cost = profit (Diminishing Musharakah, Murabaha, Islamic LTFF), rentals (Ijarah) or
// interest (conventional), plus any processing fee.
export function afterTaxFlows(
  flows: Flow[],
  markupByMonth: Map<number, number>,
  depreciableCost: number,
  taxRate: number,
  opts: DepreciationOpts = DEPRECIATION,
): Flow[] {
  return afterTaxFlowsWith(flows, markupByMonth, taxDepreciation(depreciableCost, opts), taxRate);
}

function afterTaxFlowsWith(flows: Flow[], deductibleByMonth: Map<number, number>, depreciation: number[], taxRate: number): Flow[] {
  const byMonth = new Map<number, number>();
  const add = (month: number, amount: number) => byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  for (const f of flows) add(f.month, f.amount);
  for (const [y, saved] of taxSavingsWith(deductibleByMonth, depreciation, taxRate)) add(12 * y, -saved);
  return [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([month, amount]) => ({ month, amount }));
}

export function taxSavingsByYear(
  markupByMonth: Map<number, number>,
  depreciableCost: number,
  taxRate: number,
  opts: DepreciationOpts = DEPRECIATION,
): Map<number, number> {
  return taxSavingsWith(markupByMonth, taxDepreciation(depreciableCost, opts), taxRate);
}

function taxSavingsWith(deductibleByMonth: Map<number, number>, depreciation: number[], taxRate: number): Map<number, number> {
  const deductible = new Map<number, number>();
  for (const [m, mk] of deductibleByMonth) {
    const y = Math.floor((m - 1) / 12) + 1;
    deductible.set(y, (deductible.get(y) ?? 0) + mk);
  }
  depreciation.forEach((dep, idx) => {
    if (dep !== 0) deductible.set(idx + 1, (deductible.get(idx + 1) ?? 0) + dep);
  });
  const saved = new Map<number, number>();
  for (const [y, amount] of [...deductible.entries()].sort((a, b) => a[0] - b[0])) saved.set(y, amount * taxRate);
  return saved;
}

// ---------- liquidity ----------

// Counts no sales income, so it is a floor.
export function runwayMonths(cash: number, upfront: number, monthlyFixedCosts: number, newMonthlyPayment: number): number {
  const burn = monthlyFixedCosts + newMonthlyPayment;
  if (burn <= 0) return Number.POSITIVE_INFINITY;
  return (cash - upfront) / burn;
}


// ---------- financing kinds & names ----------

export const ISLAMIC_FINANCING_TYPES = ["diminishing_musharakah", "murabaha", "ijarah", "iltf"] as const satisfies readonly FinancingType[];
export const CONVENTIONAL_FINANCING_TYPES = ["bank", "ltff"] as const satisfies readonly FinancingType[];

export function isIslamicType(type: string): boolean {
  return (ISLAMIC_FINANCING_TYPES as readonly string[]).includes(type);
}

export function isFinancedMethod(method: PaymentMethod): method is FinancingType {
  return method !== "cash" && method !== "installments";
}

// The flag wins; options saved before it existed fall back to their type.
export function isShariahCompliant(f: Pick<FinancingOption, "type"> & { shariahCompliant?: boolean }): boolean {
  return typeof f.shariahCompliant === "boolean" ? f.shariahCompliant : isIslamicType(f.type);
}

// Cash and the supplier's deferred-price plan (bay' muajjal: price fixed at the contract) are Shariah-compliant;
// financed rows follow their financing. Rows saved before the flag existed: conventional types are bank/ltff.
export function isShariahRow(row: Pick<ComparisonRow, "method"> & { shariahCompliant?: boolean }): boolean {
  if (typeof row.shariahCompliant === "boolean") return row.shariahCompliant;
  return !(CONVENTIONAL_FINANCING_TYPES as readonly string[]).includes(row.method);
}

// ---------- the owner's choice ----------

export function recommendedRowOf(result: DecideResult | null | undefined): ComparisonRow | null {
  if (!result?.rows.length) return null;
  return result.rows.find((r) => r.id === result.recommendedId) ?? result.rows.find((r) => r.recommended) ?? null;
}

// The owner's own pick on Compare, only while that row still exists in the comparison.
export function chosenRowOf(result: DecideResult | null | undefined, chosenRowId: string | null | undefined): ComparisonRow | null {
  if (!result || !chosenRowId) return null;
  return result.rows.find((r) => r.id === chosenRowId) ?? null;
}

// The row the owner goes ahead with everywhere (memo, bank request, dashboard): their pick, else the recommendation.
export function effectiveRow(result: DecideResult | null | undefined, chosenRowId: string | null | undefined): ComparisonRow | null {
  return chosenRowOf(result, chosenRowId) ?? recommendedRowOf(result);
}

// The owner's pick when it differs from the recommendation (null when they go with Faisla).
export function overrideRow(result: DecideResult | null | undefined, chosenRowId: string | null | undefined): ComparisonRow | null {
  const chosen = chosenRowOf(result, chosenRowId);
  return chosen && chosen.id !== recommendedRowOf(result)?.id ? chosen : null;
}

// Extra true cost of the owner's pick over the recommendation, after tax, in today's money (whole rupees;
// negative when the pick is cheaper but was not recommended for cash safety).
export function extraCostAfterTax(chosen: ComparisonRow, recommended: ComparisonRow): number {
  return Math.round(chosen.pvAfterTax) - Math.round(recommended.pvAfterTax);
}

export function extraCostBeforeTax(chosen: ComparisonRow, recommended: ComparisonRow): number {
  return Math.round(chosen.pvBeforeTax) - Math.round(recommended.pvBeforeTax);
}

// Plain-English product names (used in labels, verdicts, memo and emails).
export const FINANCING_NAMES: Record<FinancingType, string> = {
  diminishing_musharakah: "Diminishing Musharakah",
  murabaha: "Murabaha",
  ijarah: "Ijarah",
  iltf: "Islamic LTFF",
  bank: "conventional bank loan",
  ltff: "conventional LTFF",
};

const LABEL_NAMES: Record<FinancingType, string> = {
  diminishing_musharakah: "Diminishing Musharakah",
  murabaha: "Murabaha",
  ijarah: "Ijarah",
  iltf: "Islamic LTFF",
  bank: "conventional loan",
  ltff: "conventional LTFF",
};

// What one monthly payment is called: Ijarah pays rentals, everything else installments.
export function paymentWord(method: PaymentMethod): string {
  return method === "ijarah" ? "rental" : "installment";
}

export const SHARIAH_NOTES: string[] = [
  "Asset-backed: the bank buys, co-owns or leases the machines and earns profit or rent on them, not a return on lent money.",
  "Profit is charged only on the bank's outstanding share or cost and is never compounded; the deferred price or rental schedule is agreed upfront.",
  "Late payment: the customer undertakes to pay a fixed amount to charity; it is not income for the bank.",
  "Takaful (Islamic insurance) instead of conventional insurance on the machines.",
  "The bank's Shariah board must approve the product; confirm the approval on the term sheet.",
];

// ---------- options ----------

export type PayOption = {
  id: string;
  label: string;
  letter: string; // A, B, C… from offer order
  offer: Offer;
  method: PaymentMethod;
  shariahCompliant: boolean;
  cashPrice: number; // offer's cash price after discount
  upfront: number; // paid at delivery (month 0)
  monthlyPayment: number;
  months: number; // number of installments / rentals
  flows: Flow[];
  markupByMonth: Map<number, number>; // tax-deductible finance cost by month (profit, rentals or interest, plus fee)
  depreciableCost: number;
  depreciationByYear?: number[]; // overrides the standard schedule on depreciableCost (Ijarah: after transfer only)
  firstDueOnDelivery: boolean;
  loan: null | {
    financing: FinancingOption; // unshifted, as configured
    annualRate: number; // after any KIBOR shift
    downPayment: number; // customer's contribution (Ijarah: security deposit)
    principal: number; // amount financed (Ijarah: bank's cost net of the deposit)
    fee: number;
    totalMarkup: number; // profit / interest part of the installments
  };
};

export function offerLetter(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `#${index + 1}`;
}

export function offerCashPrice(offer: Offer): number {
  return offer.total * (1 - (offer.cashDiscountPct ?? 0) / 100);
}

function hasInstallments(offer: Offer): boolean {
  return !!offer.installmentMonths && offer.installmentMonths > 0 && !!offer.installmentAmount && offer.installmentAmount > 0;
}

function cashOption(offer: Offer, letter: string): PayOption {
  const cashPrice = offerCashPrice(offer);
  return {
    id: `${offer.id}:cash`,
    label: `${letter}, cash`,
    letter,
    offer,
    method: "cash",
    shariahCompliant: true,
    cashPrice,
    upfront: cashPrice,
    monthlyPayment: 0,
    months: 0,
    flows: [{ month: 0, amount: cashPrice }],
    markupByMonth: new Map(),
    depreciableCost: cashPrice,
    firstDueOnDelivery: false,
    loan: null,
  };
}

// The supplier's credit sale at a higher deferred price (bay' muajjal). Permissible when the price is fixed at the
// contract and nothing is added for late payment, so Faisla reports its effective yearly cost, not "interest".
function installmentOption(offer: Offer, letter: string): PayOption {
  const n = offer.installmentMonths!;
  const amount = offer.installmentAmount!;
  const due = offer.firstInstallmentOnDelivery;
  const start = due ? 0 : 1;
  const flows: Flow[] = [];
  for (let t = start; t < start + n; t++) flows.push({ month: t, amount });
  return {
    id: `${offer.id}:installments`,
    // The quotation's "0%" claim isn't on Offer; quotes with installments are the "0% markup" plans.
    label: offer.source === "quote" ? `${letter}, deferred-price plan ("0%")` : `${letter}, deferred-price plan`,
    letter,
    offer,
    method: "installments",
    shariahCompliant: true,
    cashPrice: offerCashPrice(offer),
    upfront: due ? amount : 0,
    monthlyPayment: amount,
    months: n,
    flows,
    markupByMonth: new Map(),
    depreciableCost: amount * n, // installment total
    firstDueOnDelivery: due,
    loan: null,
  };
}

function financedLabel(letter: string, financing: FinancingOption, annualRate: number): string {
  return `${letter}, ${LABEL_NAMES[financing.type] ?? financing.type} ${formatPct(annualRate)}`;
}

// Diminishing Musharakah, Murabaha, Islamic LTFF and conventional loans: customer contribution at delivery, then
// equal monthly installments; profit (or interest) part deductible, the buyer/co-owner depreciates the full cost.
function loanOption(offer: Offer, letter: string, financing: FinancingOption, kiborShift: number): PayOption {
  if (financing.type === "ijarah") return ijarahOption(offer, letter, financing, kiborShift);
  const cashPrice = offerCashPrice(offer);
  const annualRate = financing.annualRate + (financing.kiborLinked ? kiborShift : 0);
  const downPayment = cashPrice * financing.downPaymentPct;
  const principal = cashPrice - downPayment;
  const fee = principal * financing.feePct;
  const n = financing.tenorMonths;
  const schedule = amortisation(principal, annualRate, n);
  const markupByMonth = new Map<number, number>(schedule.map((r) => [r.month, r.markup]));
  // Processing fee is a finance cost, deductible in tax year 1.
  if (fee > 0) markupByMonth.set(1, (markupByMonth.get(1) ?? 0) + fee);
  const payment = schedule[0]?.payment ?? 0;
  const flows: Flow[] = [{ month: 0, amount: downPayment + fee }, ...schedule.map((r) => ({ month: r.month, amount: r.payment }))];
  return {
    id: `${offer.id}:${financing.id}`,
    label: financedLabel(letter, financing, annualRate),
    letter,
    offer,
    method: financing.type,
    shariahCompliant: isShariahCompliant(financing),
    cashPrice,
    upfront: downPayment + fee,
    monthlyPayment: payment,
    months: n,
    flows,
    markupByMonth,
    depreciableCost: cashPrice,
    firstDueOnDelivery: false,
    loan: {
      financing,
      annualRate,
      downPayment,
      principal,
      fee,
      totalMarkup: schedule.reduce((s, r) => s + r.markup, 0),
    },
  };
}

// Ijarah (lease). Month 0: security deposit (+ fee). Months 1…n: rentals that recover the bank's cost net of the
// deposit at the benchmark rate. Month n: ownership transfers by a separate sale at a residual price equal to the
// deposit, and the deposit is adjusted against it (refund − price = 0). Tax: the lessee deducts every rental as paid
// and claims no depreciation during the lease; after transfer it depreciates the purchase price (no initial allowance).
function ijarahOption(offer: Offer, letter: string, financing: FinancingOption, kiborShift: number): PayOption {
  const cashPrice = offerCashPrice(offer);
  const annualRate = financing.annualRate + (financing.kiborLinked ? kiborShift : 0);
  const deposit = cashPrice * financing.downPaymentPct;
  const leased = cashPrice - deposit;
  const fee = leased * financing.feePct;
  const n = financing.tenorMonths;
  const schedule = amortisation(leased, annualRate, n);
  const rental = schedule[0]?.payment ?? 0;
  const deductible = new Map<number, number>(schedule.map((r) => [r.month, r.payment]));
  if (fee > 0) deductible.set(1, (deductible.get(1) ?? 0) + fee);
  const purchasePrice = deposit;
  const flows: Flow[] = [
    { month: 0, amount: deposit + fee },
    ...schedule.map((r) => ({ month: r.month, amount: r.payment })),
    { month: n, amount: -deposit }, // security deposit returned…
    { month: n, amount: purchasePrice }, // …and paid back as the purchase price of the machines
  ];
  return {
    id: `${offer.id}:${financing.id}`,
    label: financedLabel(letter, financing, annualRate),
    letter,
    offer,
    method: "ijarah",
    shariahCompliant: isShariahCompliant(financing),
    cashPrice,
    upfront: deposit + fee,
    monthlyPayment: rental,
    months: n,
    flows,
    markupByMonth: deductible,
    depreciableCost: purchasePrice,
    depreciationByYear: postTransferDepreciation(purchasePrice, n),
    firstDueOnDelivery: false,
    loan: {
      financing,
      annualRate,
      downPayment: deposit,
      principal: leased,
      fee,
      totalMarkup: schedule.reduce((s, r) => s + r.markup, 0),
    },
  };
}

export function isEligible(company: Company, financing: FinancingOption): boolean {
  return !financing.requiresExporter || company.isExporter;
}

export function companyPreference(company: Partial<Pick<Company, "financingPreference">>): FinancingPreference {
  return company.financingPreference === "both" ? "both" : "islamic";
}

// Financing offered under a preference: "islamic" keeps only Shariah-compliant options; "both" keeps all.
export function financingForPreference(financing: FinancingOption[], preference: FinancingPreference): FinancingOption[] {
  return preference === "both" ? financing : financing.filter(isShariahCompliant);
}

// Cash (+ the supplier's deferred-price plan if quoted) for every offer; financing on the offer with the cheapest
// cash price. Preference defaults to the company's (then "islamic").
export function buildOptions(
  company: Company,
  offers: Offer[],
  financing: FinancingOption[],
  kiborShift = 0,
  preference: FinancingPreference = companyPreference(company),
): PayOption[] {
  const options: PayOption[] = [];
  offers.forEach((offer, idx) => {
    const letter = offerLetter(idx);
    options.push(cashOption(offer, letter));
    if (hasInstallments(offer)) options.push(installmentOption(offer, letter));
  });
  if (offers.length === 0) return options;
  let cheapestIdx = 0;
  offers.forEach((o, idx) => {
    if (offerCashPrice(o) < offerCashPrice(offers[cheapestIdx])) cheapestIdx = idx;
  });
  for (const fin of financingForPreference(financing, preference)) {
    if (!isEligible(company, fin)) continue;
    options.push(loanOption(offers[cheapestIdx], offerLetter(cheapestIdx), fin, kiborShift));
  }
  return options;
}

function afterTaxRate(company: Company): number {
  return company.discountRate * (1 - company.taxRate);
}

function shortName(row: { method: PaymentMethod; letter: string }): string {
  if (row.method === "cash") return `${row.letter} cash`;
  if (row.method === "installments") return `${row.letter} deferred-price plan`;
  if (row.method === "bank") return "the conventional loan";
  return FINANCING_NAMES[row.method];
}

function fmtMonths(m: number): string {
  return Number.isFinite(m) ? `${m.toFixed(2)} months` : "no limit";
}

function financingSteps(o: PayOption): CalculationStep[] {
  const l = o.loan!;
  const type = l.financing.type;
  const pct = formatPct(l.financing.downPaymentPct, 0);
  const steps: CalculationStep[] = [];
  const feeStep = (base: string): CalculationStep => ({
    label: "Processing fee",
    formula: `fee % × ${base}, paid at delivery`,
    inputs: { "fee %": formatPct(l.financing.feePct, 2), P: formatPKR(l.principal) },
    result: formatPKR(l.fee),
  });
  const annuity = "P · i · (1 + i)^n ÷ ((1 + i)^n − 1)";

  if (type === "ijarah") {
    steps.push({
      label: "Security deposit",
      formula: "cash price × security deposit %, paid at delivery; adjusted against the purchase price at the end",
      inputs: { "cash price": formatPKR(o.cashPrice), "security deposit": pct },
      result: formatPKR(l.downPayment),
    });
    steps.push({
      label: "Bank's cost to recover",
      formula: "P = cash price − security deposit",
      inputs: { "cash price": formatPKR(o.cashPrice), "security deposit": formatPKR(l.downPayment) },
      result: formatPKR(l.principal),
    });
    if (l.fee > 0) steps.push(feeStep("P"));
    steps.push({
      label: "Monthly rental",
      formula: `${annuity}, i = rental rate ÷ 12 (KIBOR-benchmarked); paid in arrears`,
      inputs: { P: formatPKR(l.principal), "rental rate": formatPct(l.annualRate), n: o.months },
      result: formatPKR(o.monthlyPayment),
    });
    steps.push({
      label: "Total rentals (tax-deductible as paid)",
      formula: "rental × n; the lessee deducts each rental, and claims no depreciation during the lease",
      inputs: { rental: formatPKR(o.monthlyPayment), n: o.months },
      result: formatPKR(o.monthlyPayment * o.months),
    });
    steps.push({
      label: "End of lease",
      formula: "ownership transferred by a separate sale; purchase price = security deposit, so the deposit is adjusted against it",
      inputs: { "deposit returned": formatPKR(l.downPayment), "purchase price": formatPKR(l.downPayment) },
      result: formatPKR(0),
    });
    return steps;
  }

  const islamic = isShariahCompliant(l.financing);
  const rateKey = islamic ? "profit rate" : "yearly rate";
  if (type === "diminishing_musharakah" || type === "iltf") {
    steps.push({
      label: "Bank's share of the machines",
      formula: `P = cash price × (1 − your share %); you co-own the rest from day one`,
      inputs: { "cash price": formatPKR(o.cashPrice), "your share": `${pct} = ${formatPKR(l.downPayment)}` },
      result: formatPKR(l.principal),
    });
  } else if (type === "murabaha") {
    steps.push({
      label: "Amount financed",
      formula: "P = cash price × (1 − your advance %); the bank buys the machines and sells them to you",
      inputs: { "cash price": formatPKR(o.cashPrice), "your advance": `${pct} = ${formatPKR(l.downPayment)}` },
      result: formatPKR(l.principal),
    });
  } else {
    steps.push({
      label: "Loan amount",
      formula: "P = cash price × (1 − down payment %)",
      inputs: { "cash price": formatPKR(o.cashPrice), "down payment": `${pct} = ${formatPKR(l.downPayment)}` },
      result: formatPKR(l.principal),
    });
  }
  if (l.fee > 0) steps.push(feeStep("P"));

  if (type === "diminishing_musharakah" || type === "iltf") {
    steps.push({
      label: "Monthly installment",
      formula: `${annuity}, i = ${rateKey} ÷ 12; each installment = rent on the bank's remaining share + purchase of its units`,
      inputs: { P: formatPKR(l.principal), [rateKey]: formatPct(l.annualRate), n: o.months },
      result: formatPKR(o.monthlyPayment),
    });
    steps.push({
      label: "Total rent paid to the bank (profit)",
      formula: "Σ bank's remaining share × i over the schedule (tax-deductible); never compounded",
      inputs: { months: o.months },
      result: formatPKR(l.totalMarkup),
    });
  } else if (type === "murabaha") {
    steps.push({
      label: "Monthly installment",
      formula: `${annuity}, i = ${rateKey} ÷ 12; deferred price = installment × n, fixed at the contract`,
      inputs: { P: formatPKR(l.principal), [rateKey]: formatPct(l.annualRate), n: o.months },
      result: formatPKR(o.monthlyPayment),
    });
    steps.push({
      label: "Bank's profit in the deferred price",
      formula: "deferred price − amount financed (tax-deductible as it falls due); never increased for late payment",
      inputs: { "deferred price": formatPKR(o.monthlyPayment * o.months), P: formatPKR(l.principal) },
      result: formatPKR(l.totalMarkup),
    });
  } else {
    steps.push({
      label: "Monthly installment (interest-based)",
      formula: `${annuity}, i = yearly rate ÷ 12`,
      inputs: { P: formatPKR(l.principal), [rateKey]: formatPct(l.annualRate), n: o.months },
      result: formatPKR(o.monthlyPayment),
    });
    steps.push({
      label: "Total interest paid",
      formula: "Σ balance × i over the schedule (tax-deductible)",
      inputs: { months: o.months },
      result: formatPKR(l.totalMarkup),
    });
  }
  return steps;
}

function calculationSteps(o: PayOption, company: Company, c: Computed): CalculationStep[] {
  const steps: CalculationStep[] = [];
  const atRate = afterTaxRate(company);
  if (o.method === "cash") {
    steps.push({
      label: "Cash price",
      formula: "list total × (1 − cash discount)",
      inputs: { "list total": formatPKR(o.offer.total), "cash discount": `${o.offer.cashDiscountPct ?? 0}%` },
      result: formatPKR(o.cashPrice),
    });
  }
  if (o.method === "installments" && c.hiddenMonthly !== null) {
    steps.push({
      label: "Effective monthly cost of paying later",
      formula: o.firstDueOnDelivery
        ? "cash price = Σ installment ÷ (1 + r)^t, t = 0…n−1 (solved by bisection)"
        : "cash price = Σ installment ÷ (1 + r)^t, t = 1…n (solved by bisection)",
      inputs: {
        "cash price": formatPKR(o.cashPrice),
        installment: formatPKR(o.monthlyPayment),
        n: o.months,
        "first installment": o.firstDueOnDelivery ? "on delivery" : "one month after delivery",
      },
      result: `${formatPct(c.hiddenMonthly, 4)} a month`,
    });
    steps.push({
      label: "Effective yearly cost",
      formula: "(1 + r)^12 − 1   (simple quote: r × 12); a deferred-price sale at a price fixed upfront",
      inputs: { r: formatPct(c.hiddenMonthly, 4), "simple quote r × 12": formatPct(c.hiddenMonthly * 12, 2) },
      result: formatPct(yearlyFromMonthly(c.hiddenMonthly), 2),
    });
  }
  if (o.loan) steps.push(...financingSteps(o));
  steps.push({
    label: "PV before tax",
    formula: "Σ flow_t ÷ (1 + d)^t, d = (1 + yearly discount)^(1/12) − 1",
    inputs: {
      "paid at delivery": formatPKR(o.upfront),
      ...(o.months > 0 ? { [`monthly ${paymentWord(o.method)}`]: formatPKR(o.monthlyPayment), months: o.months } : {}),
      "discount rate": formatPct(company.discountRate),
      d: formatPct(monthlyFromYearly(company.discountRate), 4),
    },
    result: formatPKR(c.pvBeforeTax),
  });
  const firstDep = c.depreciation.findIndex((d) => d > 0);
  steps.push(
    o.method === "ijarah"
      ? {
          label: "Tax depreciation (after transfer)",
          formula: "none during the lease; from the next tax year, 15% reducing balance on the purchase price (no initial allowance), rest in year 10",
          inputs: {
            "depreciation base": formatPKR(o.depreciableCost),
            [`year ${firstDep + 1}`]: formatPKR(c.depreciation[firstDep] ?? 0),
            "year 10": formatPKR(c.depreciation[c.depreciation.length - 1] ?? 0),
          },
          result: formatPKR(c.depreciation.reduce((s, d) => s + d, 0)),
        }
      : {
          label: "Tax depreciation",
          formula: "25% initial allowance + 15% reducing balance (year 1 too), 10 years, rest in year 10",
          inputs: {
            "depreciation base": formatPKR(o.depreciableCost),
            "year 1": formatPKR(c.depreciation[0] ?? 0),
            "year 2": formatPKR(c.depreciation[1] ?? 0),
            "year 10": formatPKR(c.depreciation[c.depreciation.length - 1] ?? 0),
          },
          result: formatPKR(c.depreciation.reduce((s, d) => s + d, 0)),
        },
  );
  const deductibleName =
    o.method === "ijarah" ? "rentals_y" : o.loan && !isShariahCompliant(o.loan.financing) ? "interest_y" : "profit_y";
  steps.push({
    label: "PV after tax",
    formula: `Σ (flow_t − tax saved_t) ÷ (1 + d′)^t; tax saved in year y = (${deductibleName} + depreciation_y) × tax rate at month 12y; d′ from discount × (1 − tax rate)`,
    inputs: {
      "tax rate": formatPct(company.taxRate, 0),
      "after-tax discount": formatPct(atRate, 2),
      "total tax saved": formatPKR(c.totalTaxSaved),
    },
    result: formatPKR(c.pvAfterTax),
  });
  steps.push({
    label: "Runway",
    formula: `(cash − paid at delivery) ÷ (monthly fixed costs + new monthly ${paymentWord(o.method)})`,
    inputs: {
      cash: formatPKR(company.cashBalance),
      "paid at delivery": formatPKR(o.upfront),
      "fixed costs": formatPKR(company.monthlyFixedCosts),
      [`new monthly ${paymentWord(o.method)}`]: formatPKR(o.monthlyPayment),
    },
    result: fmtMonths(c.runway),
  });
  return steps;
}

type Computed = {
  pvBeforeTax: number;
  pvAfterTax: number;
  runway: number;
  hiddenMonthly: number | null;
  depreciation: number[];
  totalTaxSaved: number;
};

function compute(o: PayOption, company: Company): Computed {
  const depreciation = o.depreciationByYear ?? taxDepreciation(o.depreciableCost);
  const atFlows = afterTaxFlowsWith(o.flows, o.markupByMonth, depreciation, company.taxRate);
  const saved = taxSavingsWith(o.markupByMonth, depreciation, company.taxRate);
  return {
    pvBeforeTax: presentValue(o.flows, company.discountRate),
    pvAfterTax: presentValue(atFlows, afterTaxRate(company)),
    runway: runwayMonths(company.cashBalance, o.upfront, company.monthlyFixedCosts, o.monthlyPayment),
    hiddenMonthly:
      o.method === "installments" ? hiddenMonthlyRate(o.cashPrice, o.monthlyPayment, o.months, o.firstDueOnDelivery) : null,
    depreciation,
    totalTaxSaved: [...saved.values()].reduce((s, v) => s + v, 0),
  };
}

// Before/after-tax PV, runway, recommendation and verdicts. Rows sorted by pvAfterTax ascending.
export function compareOptions(options: PayOption[], company: Company): ComparisonRow[] {
  const computed = options.map((o) => compute(o, company));
  if (options.length === 0) return [];

  // Recommended = lowest after-tax PV among Shariah-compliant rows (cash, the supplier's deferred-price plan, Islamic
  // financing) that keep ≥ 2 months of runway (fallback: lowest Shariah-compliant). Conventional rows never win.
  const byPv = (idxs: number[]) => idxs.reduce((best, i) => (computed[i].pvAfterTax < computed[best].pvAfterTax ? i : best));
  const all = options.map((_, i) => i);
  const compliant = all.filter((i) => options[i].shariahCompliant);
  const pool = compliant.length ? compliant : all;
  const safe = pool.filter((i) => computed[i].runway >= SAFE_RUNWAY);
  // Owner prefers to buy outright: the cheapest cash purchase wins if it still leaves the safe runway.
  const cashSafe = safe.filter((i) => options[i].method === "cash");
  const recIdx = company.payInFullWhenAffordable && cashSafe.length ? byPv(cashSafe) : byPv(safe.length ? safe : pool);
  const rec = options[recIdx];

  const cashPrices = options.filter((o) => o.method === "cash").map((o) => o.cashPrice);
  const minCash = Math.min(...cashPrices);

  const rows = options.map((o, i): ComparisonRow => {
    const c = computed[i];
    const hiddenYearly = c.hiddenMonthly === null ? null : yearlyFromMonthly(c.hiddenMonthly);
    let verdict: string;
    if (i === recIdx) verdict = "Recommended";
    else if (!o.shariahCompliant) verdict = "Interest-based, for comparison only";
    else if (hiddenYearly !== null && hiddenYearly > 0.005) verdict = `Paying later costs ${formatPct(hiddenYearly)} a year`;
    else if (o.method === "cash" && o.cashPrice === minCash)
      verdict = c.runway < SAFE_RUNWAY ? "Cheapest price, drains cash" : "Cheapest price";
    else if (c.runway < SALARIES_AT_RISK_RUNWAY) verdict = "Salaries at risk";
    else if (c.runway < SAFE_RUNWAY) verdict = "Tight on cash";
    // Only reachable when "pay in full when affordable" picked a cash row over cheaper financing.
    else if (c.pvAfterTax < computed[recIdx].pvAfterTax) verdict = "Cheaper in today's money, but uses financing";
    else verdict = `Safe, dearer than ${shortName(rec)}`;

    return {
      id: o.id,
      label: o.label,
      offerId: o.offer.id,
      supplierName: o.offer.supplierName,
      method: o.method,
      financingId: o.loan?.financing.id ?? null,
      cashPrice: o.cashPrice,
      upfront: o.upfront,
      monthlyPayment: o.monthlyPayment,
      months: o.months,
      totalPaid: o.flows.reduce((s, f) => s + f.amount, 0),
      pvBeforeTax: c.pvBeforeTax,
      pvAfterTax: c.pvAfterTax,
      runwayMonths: c.runway,
      hiddenYearlyRate: hiddenYearly,
      hiddenSimpleRate: c.hiddenMonthly === null ? null : c.hiddenMonthly * 12,
      shariahCompliant: o.shariahCompliant,
      verdict,
      recommended: i === recIdx,
      calculation: calculationSteps(o, company, c),
    };
  });
  return rows.sort((a, b) => a.pvAfterTax - b.pvAfterTax);
}

// Yearly discount rate at which the option's pre-tax PV equals the cash price (bisection).
// Above this rate, financing beats paying cash. Null if no break-even in 0–100%.
export function breakEvenDiscountRate(option: PayOption, cashPrice: number): number | null {
  const pvAt = (rate: number) => presentValue(option.flows, rate);
  if (pvAt(0) <= cashPrice) return 0;
  if (pvAt(1) > cashPrice) return null;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pvAt(mid) > cashPrice) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Re-prices KIBOR-linked financing (Diminishing Musharakah, Ijarah, conventional loans) with the shift; Islamic LTFF
// and LTFF follow the SBP rate and Murabaha's price is fixed at the contract, so they are unchanged.
export function stressTest(options: PayOption[], kiborShift: number, company: Company): ComparisonRow[] {
  const shifted = options.map((o) =>
    o.loan && o.loan.financing.kiborLinked ? loanOption(o.offer, o.letter, o.loan.financing, kiborShift) : o,
  );
  return compareOptions(shifted, company);
}

function names(list: FinancingOption[]): string {
  const unique = [...new Set(list.map((f) => FINANCING_NAMES[f.type] ?? f.type))];
  if (unique.length <= 1) return unique.join("");
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
}

export function buildAssumptions(
  company: Company,
  financing: FinancingOption[],
  kiborShift: number,
  preference: FinancingPreference = companyPreference(company),
): string[] {
  const offered = financingForPreference(financing, preference).filter((f) => isEligible(company, f));
  const fees = offered.map((f) => `${FINANCING_NAMES[f.type] ?? f.type} ${formatPct(f.feePct, 2)}`).join(", ");
  const islamic = offered.filter(isShariahCompliant);
  const hasIjarah = offered.some((f) => f.type === "ijarah");
  const out = [
    preference === "islamic"
      ? "Financing preference: Shariah-compliant only. Conventional (interest-based) options are left out; switch to “Islamic and conventional” on the Financing page to see them for comparison."
      : "Financing preference: Islamic and conventional. Conventional (interest-based) rows are shown for comparison only and are never recommended.",
    company.payInFullWhenAffordable
      ? `Pay in full when affordable: on. Buying outright is recommended whenever it still leaves at least ${SAFE_RUNWAY} months of fixed costs in the bank.`
      : `Pay in full when affordable: off. Buying outright is recommended only if it is also the cheapest option in today's money and leaves at least ${SAFE_RUNWAY} months of fixed costs (turn it on in Settings to always prefer paying in full when cash allows).`,
    `Discount rate ${formatPct(company.discountRate)} a year before tax (≈ the business's cost of financing, KIBOR + 3%); after-tax flows are discounted at ${formatPct(afterTaxRate(company), 2)} = ${formatPct(company.discountRate)} × (1 − ${formatPct(company.taxRate, 0)} tax).`,
    `Processing fees default to 0% and are editable${fees ? ` (now: ${fees} of the amount financed)` : ""}; they are paid at delivery and deducted in tax year 1. Insurance (takaful) and collateral costs are not included.`,
    "Installments and rentals are paid monthly in arrears (first payment one month after delivery) unless the quotation says the first installment is due on delivery. Profit uses the bank convention i = yearly rate ÷ 12 on the outstanding amount and is never compounded.",
    `Tax savings (${formatPct(company.taxRate, 0)} of deductible ${preference === "both" ? "profit, rentals or interest" : "profit or rentals"} + depreciation) arrive at the end of each tax year (months 12, 24, …).`,
    "Tax depreciation: 25% initial allowance in year 1, then 15% a year on the reducing balance (including year 1, on cost less the allowance), 10-year life, remainder written off in year 10. Base = what each option actually pays for the machines (cash, deferred-price plan, Diminishing Musharakah, Murabaha).",
    "The supplier's deferred-price plan (bay' muajjal) is a permissible credit sale when the price is fixed at the contract and nothing is added for late payment; Faisla shows its effective yearly cost against the cash price.",
  ];
  if (hasIjarah) {
    out.push(
      "Ijarah: the security deposit is held by the bank and adjusted against the purchase price when ownership transfers at the end by a separate sale, so the end-of-lease cash flow is nil. Rentals are deducted as paid; the lessee claims no depreciation during the lease, then 15% reducing balance on the purchase price (no initial allowance).",
    );
  }
  if (islamic.length) {
    out.push(`Shariah notes: ${SHARIAH_NOTES.join(" ")}`);
  }
  out.push("Scrap value is ignored (the same for every option).");
  out.push("Runway counts no sales income, so it is a floor (worst case), not a forecast.");
  const sbp = financingForPreference(financing, preference).filter((f) => f.type === "iltf" || f.type === "ltff");
  if (sbp.length) {
    const name = sbp.some((f) => f.type === "iltf") ? "Islamic LTFF" : "LTFF";
    out.push(
      company.isExporter
        ? `${name} approval usually takes about 4–8 weeks; eligibility (exporter buying new machinery) must be confirmed by the bank.`
        : `${name} left out: it is only for exporters buying new machinery.`,
    );
  }
  if (kiborShift !== 0) {
    const moved = offered.filter((f) => f.kiborLinked);
    const fixed = offered.filter((f) => !f.kiborLinked);
    out.push(
      `Stress test: KIBOR-linked rates${moved.length ? ` (${names(moved)})` : ""} shifted by ${kiborShift > 0 ? "+" : ""}${formatPct(kiborShift)}` +
        (fixed.length ? `; ${names(fixed)} ${fixed.length === 1 ? "is" : "are"} not shifted (SBP-set rate or price fixed at the contract).` : "."),
    );
  }
  return out;
}

export function decide(input: DecideInput): DecideResult {
  const { company, offers, financing } = input;
  const kiborShift = input.kiborShift ?? 0;
  const preference = input.preference ?? companyPreference(company);
  if (offers.length === 0) throw new Error("decide needs at least one offer");

  const options = buildOptions(company, offers, financing, kiborShift, preference);
  const rows = compareOptions(options, company);
  const recommended = rows.find((r) => r.recommended)!;

  const quote = offers.find((o) => o.source === "quote");
  const baseline = quote
    ? (rows.find((r) => r.id === `${quote.id}:installments`) ?? rows.find((r) => r.id === `${quote.id}:cash`) ?? null)
    : null;
  // Differences of the rounded (displayed) PVs, so the summary matches the table to the rupee.
  const savingsVsBaseline = baseline
    ? {
        beforeTax: Math.round(baseline.pvBeforeTax) - Math.round(recommended.pvBeforeTax),
        afterTax: Math.round(baseline.pvAfterTax) - Math.round(recommended.pvAfterTax),
      }
    : null;

  let breakEven: number | null = null;
  if (recommended.method !== "cash") {
    const cashRows = rows.filter((r) => r.method === "cash");
    const cheapestCash = cashRows.reduce((a, b) => (b.cashPrice < a.cashPrice ? b : a), cashRows[0]);
    const recOption = options.find((o) => o.id === recommended.id)!;
    breakEven = breakEvenDiscountRate(recOption, cheapestCash.cashPrice);
  }

  return {
    rows,
    recommendedId: recommended.id,
    baselineId: baseline?.id ?? null,
    savingsVsBaseline,
    runwayToday: runwayMonths(company.cashBalance, 0, company.monthlyFixedCosts, 0),
    breakEvenDiscountRate: breakEven,
    afterTaxDiscountRate: afterTaxRate(company),
    kiborShift,
    financingPreference: preference,
    assumptions: buildAssumptions(company, financing, kiborShift, preference),
    company,
  };
}
