// Faisla finance engine (TECHNICAL_SPEC.md §4). Pure maths: no AI, no I/O.
// Faithful port of reference/finance_reference.py — every number on screen comes from here.
import { formatPKR, formatPct } from "./format";
import type {
  CalculationStep,
  Company,
  ComparisonRow,
  DecideInput,
  DecideResult,
  FinancingOption,
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

// ---------- loan ----------

// Bank convention: i = yearlyRate / 12.
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

// Tax saved in year y = (markup_y + depreciation_y) × taxRate, received at month 12y (as negative cash out).
export function afterTaxFlows(
  flows: Flow[],
  markupByMonth: Map<number, number>,
  depreciableCost: number,
  taxRate: number,
  opts: DepreciationOpts = DEPRECIATION,
): Flow[] {
  const byMonth = new Map<number, number>();
  const add = (month: number, amount: number) => byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  for (const f of flows) add(f.month, f.amount);
  for (const [y, saved] of taxSavingsByYear(markupByMonth, depreciableCost, taxRate, opts)) add(12 * y, -saved);
  return [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([month, amount]) => ({ month, amount }));
}

export function taxSavingsByYear(
  markupByMonth: Map<number, number>,
  depreciableCost: number,
  taxRate: number,
  opts: DepreciationOpts = DEPRECIATION,
): Map<number, number> {
  const deductible = new Map<number, number>();
  for (const [m, mk] of markupByMonth) {
    const y = Math.floor((m - 1) / 12) + 1;
    deductible.set(y, (deductible.get(y) ?? 0) + mk);
  }
  taxDepreciation(depreciableCost, opts).forEach((dep, idx) => {
    deductible.set(idx + 1, (deductible.get(idx + 1) ?? 0) + dep);
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

// ---------- options ----------

export type PayOption = {
  id: string;
  label: string;
  letter: string; // A, B, C… from offer order
  offer: Offer;
  method: PaymentMethod;
  cashPrice: number; // offer's cash price after discount
  upfront: number; // paid at delivery (month 0)
  monthlyPayment: number;
  months: number; // number of installments / EMIs
  flows: Flow[];
  markupByMonth: Map<number, number>; // tax-deductible finance cost by month
  depreciableCost: number;
  firstDueOnDelivery: boolean;
  loan: null | {
    financing: FinancingOption; // unshifted, as configured
    annualRate: number; // after any KIBOR shift
    downPayment: number;
    principal: number;
    fee: number;
    totalMarkup: number;
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
    label: offer.source === "quote" ? `${letter}, "0%" installments` : `${letter}, installments`,
    letter,
    offer,
    method: "installments",
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

function loanOption(offer: Offer, letter: string, financing: FinancingOption, kiborShift: number): PayOption {
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
  const name = financing.type === "ltff" ? "LTFF" : "bank";
  return {
    id: `${offer.id}:${financing.id}`,
    label: `${letter}, ${name} ${formatPct(annualRate)}`,
    letter,
    offer,
    method: financing.type,
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

export function isEligible(company: Company, financing: FinancingOption): boolean {
  return !financing.requiresExporter || company.isExporter;
}

// Cash (+ installments if quoted) for every offer; loans on the offer with the cheapest cash price.
export function buildOptions(company: Company, offers: Offer[], financing: FinancingOption[], kiborShift = 0): PayOption[] {
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
  for (const fin of financing) {
    if (!isEligible(company, fin)) continue;
    options.push(loanOption(offers[cheapestIdx], offerLetter(cheapestIdx), fin, kiborShift));
  }
  return options;
}

function afterTaxRate(company: Company): number {
  return company.discountRate * (1 - company.taxRate);
}

function shortName(row: { method: PaymentMethod; label: string; letter: string }): string {
  if (row.method === "ltff") return "LTFF";
  if (row.method === "bank") return "the bank loan";
  if (row.method === "cash") return `${row.letter} cash`;
  return `${row.letter} installments`;
}

function fmtMonths(m: number): string {
  return Number.isFinite(m) ? `${m.toFixed(2)} months` : "no limit";
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
      label: "Hidden monthly rate",
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
      label: "Hidden yearly rate",
      formula: "(1 + r)^12 − 1   (simple quote: r × 12)",
      inputs: { r: formatPct(c.hiddenMonthly, 4), "simple quote r × 12": formatPct(c.hiddenMonthly * 12, 2) },
      result: formatPct(yearlyFromMonthly(c.hiddenMonthly), 2),
    });
  }
  if (o.loan) {
    const l = o.loan;
    steps.push({
      label: "Loan amount",
      formula: "P = cash price × (1 − down payment %)",
      inputs: { "cash price": formatPKR(o.cashPrice), "down payment": `${formatPct(l.financing.downPaymentPct, 0)} = ${formatPKR(l.downPayment)}` },
      result: formatPKR(l.principal),
    });
    if (l.fee > 0) {
      steps.push({
        label: "Processing fee",
        formula: "fee % × P, paid at delivery",
        inputs: { "fee %": formatPct(l.financing.feePct, 2), P: formatPKR(l.principal) },
        result: formatPKR(l.fee),
      });
    }
    steps.push({
      label: "Monthly payment (EMI)",
      formula: "P · i · (1 + i)^n ÷ ((1 + i)^n − 1), i = yearly rate ÷ 12",
      inputs: { P: formatPKR(l.principal), "yearly rate": formatPct(l.annualRate), n: o.months },
      result: formatPKR(o.monthlyPayment),
    });
    steps.push({
      label: "Total markup paid",
      formula: "Σ balance × i over the schedule (tax-deductible)",
      inputs: { months: o.months },
      result: formatPKR(l.totalMarkup),
    });
  }
  steps.push({
    label: "PV before tax",
    formula: "Σ flow_t ÷ (1 + d)^t, d = (1 + yearly discount)^(1/12) − 1",
    inputs: {
      "paid at delivery": formatPKR(o.upfront),
      ...(o.months > 0 ? { "monthly payment": formatPKR(o.monthlyPayment), months: o.months } : {}),
      "discount rate": formatPct(company.discountRate),
      d: formatPct(monthlyFromYearly(company.discountRate), 4),
    },
    result: formatPKR(c.pvBeforeTax),
  });
  steps.push({
    label: "Tax depreciation",
    formula: "25% initial allowance + 15% reducing balance (year 1 too), 10 years, rest in year 10",
    inputs: {
      "depreciation base": formatPKR(o.depreciableCost),
      "year 1": formatPKR(c.depreciation[0] ?? 0),
      "year 2": formatPKR(c.depreciation[1] ?? 0),
      "year 10": formatPKR(c.depreciation[c.depreciation.length - 1] ?? 0),
    },
    result: formatPKR(c.depreciation.reduce((s, d) => s + d, 0)),
  });
  steps.push({
    label: "PV after tax",
    formula: "Σ (flow_t − tax saved_t) ÷ (1 + d′)^t; tax saved in year y = (markup_y + depreciation_y) × tax rate at month 12y; d′ from discount × (1 − tax rate)",
    inputs: {
      "tax rate": formatPct(company.taxRate, 0),
      "after-tax discount": formatPct(atRate, 2),
      "total tax saved": formatPKR(c.totalTaxSaved),
    },
    result: formatPKR(c.pvAfterTax),
  });
  steps.push({
    label: "Runway",
    formula: "(cash − paid at delivery) ÷ (monthly fixed costs + new monthly payment)",
    inputs: {
      cash: formatPKR(company.cashBalance),
      "paid at delivery": formatPKR(o.upfront),
      "fixed costs": formatPKR(company.monthlyFixedCosts),
      "new monthly payment": formatPKR(o.monthlyPayment),
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
  const atFlows = afterTaxFlows(o.flows, o.markupByMonth, o.depreciableCost, company.taxRate);
  const saved = taxSavingsByYear(o.markupByMonth, o.depreciableCost, company.taxRate);
  return {
    pvBeforeTax: presentValue(o.flows, company.discountRate),
    pvAfterTax: presentValue(atFlows, afterTaxRate(company)),
    runway: runwayMonths(company.cashBalance, o.upfront, company.monthlyFixedCosts, o.monthlyPayment),
    hiddenMonthly:
      o.method === "installments" ? hiddenMonthlyRate(o.cashPrice, o.monthlyPayment, o.months, o.firstDueOnDelivery) : null,
    depreciation: taxDepreciation(o.depreciableCost),
    totalTaxSaved: [...saved.values()].reduce((s, v) => s + v, 0),
  };
}

// Before/after-tax PV, runway, recommendation and verdicts. Rows sorted by pvAfterTax ascending.
export function compareOptions(options: PayOption[], company: Company): ComparisonRow[] {
  const computed = options.map((o) => compute(o, company));
  if (options.length === 0) return [];

  // Recommended = lowest after-tax PV among rows that keep ≥ 2 months of runway (fallback: lowest overall).
  const byPv = (idxs: number[]) => idxs.reduce((best, i) => (computed[i].pvAfterTax < computed[best].pvAfterTax ? i : best));
  const all = options.map((_, i) => i);
  const safe = all.filter((i) => computed[i].runway >= SAFE_RUNWAY);
  const recIdx = byPv(safe.length ? safe : all);
  const rec = options[recIdx];

  const cashPrices = options.filter((o) => o.method === "cash").map((o) => o.cashPrice);
  const minCash = Math.min(...cashPrices);

  const rows = options.map((o, i): ComparisonRow => {
    const c = computed[i];
    const hiddenYearly = c.hiddenMonthly === null ? null : yearlyFromMonthly(c.hiddenMonthly);
    let verdict: string;
    if (i === recIdx) verdict = "Recommended";
    else if (hiddenYearly !== null && hiddenYearly > 0.005) verdict = `Hidden ${formatPct(hiddenYearly)} a year`;
    else if (o.method === "cash" && o.cashPrice === minCash)
      verdict = c.runway < SAFE_RUNWAY ? "Cheapest price, drains cash" : "Cheapest price";
    else if (c.runway < SALARIES_AT_RISK_RUNWAY) verdict = "Salaries at risk";
    else if (c.runway < SAFE_RUNWAY) verdict = "Tight on cash";
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

// Re-prices KIBOR-linked loans with the shift; everything else is unchanged.
export function stressTest(options: PayOption[], kiborShift: number, company: Company): ComparisonRow[] {
  const shifted = options.map((o) =>
    o.loan && o.loan.financing.kiborLinked ? loanOption(o.offer, o.letter, o.loan.financing, kiborShift) : o,
  );
  return compareOptions(shifted, company);
}

export function buildAssumptions(company: Company, financing: FinancingOption[], kiborShift: number): string[] {
  const loans = financing.filter((f) => isEligible(company, f));
  const fees = loans.map((f) => `${f.type === "ltff" ? "LTFF" : "bank"} ${formatPct(f.feePct, 2)}`).join(", ");
  const out = [
    `Discount rate ${formatPct(company.discountRate)} a year before tax (≈ bank borrowing rate, KIBOR + 3%); after-tax flows are discounted at ${formatPct(afterTaxRate(company), 2)} = ${formatPct(company.discountRate)} × (1 − ${formatPct(company.taxRate, 0)} tax).`,
    `Processing fees default to 0% and are editable${fees ? ` (now: ${fees} of the loan)` : ""}; they are paid at delivery and deducted in tax year 1. Insurance and collateral costs are not included.`,
    "Loan and installment payments are in arrears (first payment one month after delivery) unless the quotation says the first installment is due on delivery. Loan markup uses the bank convention i = yearly rate ÷ 12.",
    `Tax savings (${formatPct(company.taxRate, 0)} of markup + depreciation) arrive at the end of each tax year (months 12, 24, …).`,
    "Tax depreciation: 25% initial allowance in year 1, then 15% a year on the reducing balance (including year 1, on cost less the allowance), 10-year life, remainder written off in year 10. Base = what each option actually pays for the machines.",
    "Scrap value is ignored (the same for every option).",
    "Runway counts no sales income, so it is a floor (worst case), not a forecast.",
  ];
  if (financing.some((f) => f.type === "ltff")) {
    out.push(
      company.isExporter
        ? "LTFF approval usually takes about 4–8 weeks; eligibility (exporter buying new machinery) must be confirmed by the bank."
        : "LTFF left out: it is only for exporters buying new machinery.",
    );
  }
  if (kiborShift !== 0) {
    out.push(
      `Stress test: KIBOR-linked rates shifted by ${kiborShift > 0 ? "+" : ""}${formatPct(kiborShift)}; LTFF follows the SBP policy rate and is not shifted.`,
    );
  }
  return out;
}

export function decide(input: DecideInput): DecideResult {
  const { company, offers, financing } = input;
  const kiborShift = input.kiborShift ?? 0;
  if (offers.length === 0) throw new Error("decide needs at least one offer");

  const options = buildOptions(company, offers, financing, kiborShift);
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
    assumptions: buildAssumptions(company, financing, kiborShift),
    company,
  };
}
