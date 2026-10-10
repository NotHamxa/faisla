// Hand-built DecideResult matching TECHNICAL_SPEC.md §4.5 (the demo comparison table).
// Used by memo/number-check tests; "show calculation" steps are trimmed but use finance.ts's input style.
import { demoCompany } from "../demoData";
import type { ComparisonRow, DecideResult } from "../types";

const bankEmi = 166_753.46;
const ltffEmi = 152_281.8;
const hiddenMonthly = 0.013067;

const rowLtff: ComparisonRow = {
  id: "offer-b:ltff",
  label: "B, LTFF 8.5%",
  offerId: "offer-b",
  supplierName: "Madina Sewing Solutions",
  method: "ltff",
  financingId: "ltff",
  cashPrice: 53_60_000,
  upfront: 5_36_000,
  monthlyPayment: ltffEmi,
  months: 36,
  totalPaid: 5_36_000 + 36 * ltffEmi,
  pvBeforeTax: 49_87_935,
  pvAfterTax: 40_13_687,
  runwayMonths: 2.5913,
  hiddenYearlyRate: null,
  hiddenSimpleRate: null,
  verdict: "Recommended",
  recommended: true,
  calculation: [
    {
      label: "Loan EMI",
      formula: "P · i · (1 + i)^n / ((1 + i)^n − 1), i = yearlyRate / 12",
      inputs: { P: "Rs 48,24,000", "yearly rate": "8.5%", n: 36 },
      result: ltffEmi,
    },
    {
      label: "Runway",
      formula: "(cash − upfront) ÷ (monthly fixed costs + monthly payment)",
      inputs: { cash: 1_00_00_000, upfront: 5_36_000, monthlyFixedCosts: 35_00_000, monthlyPayment: ltffEmi },
      result: 2.5913,
    },
  ],
};

const rowBCash: ComparisonRow = {
  id: "offer-b:cash",
  label: "B, cash",
  offerId: "offer-b",
  supplierName: "Madina Sewing Solutions",
  method: "cash",
  financingId: null,
  cashPrice: 53_60_000,
  upfront: 53_60_000,
  monthlyPayment: 0,
  months: 0,
  totalPaid: 53_60_000,
  pvBeforeTax: 53_60_000,
  pvAfterTax: 42_92_409,
  runwayMonths: 1.3257,
  hiddenYearlyRate: null,
  hiddenSimpleRate: null,
  verdict: "Cheapest price, drains cash",
  recommended: false,
  calculation: [
    {
      label: "Runway",
      formula: "(cash − upfront) ÷ monthly fixed costs",
      inputs: { cash: 1_00_00_000, upfront: 53_60_000, monthlyFixedCosts: 35_00_000 },
      result: 1.3257,
    },
  ],
};

const rowBank: ComparisonRow = {
  id: "offer-b:bank",
  label: "B, bank 14.8%",
  offerId: "offer-b",
  supplierName: "Madina Sewing Solutions",
  method: "bank",
  financingId: "bank",
  cashPrice: 53_60_000,
  upfront: 5_36_000,
  monthlyPayment: bankEmi,
  months: 36,
  totalPaid: 5_36_000 + 36 * bankEmi,
  pvBeforeTax: 54_11_012,
  pvAfterTax: 43_32_522,
  runwayMonths: 2.581,
  hiddenYearlyRate: null,
  hiddenSimpleRate: null,
  verdict: "Safe, dearer than LTFF",
  recommended: false,
  calculation: [
    {
      label: "Loan EMI",
      formula: "P · i · (1 + i)^n / ((1 + i)^n − 1), i = yearlyRate / 12",
      inputs: { P: "Rs 48,24,000", "yearly rate": "14.8%", n: 36 },
      result: bankEmi,
    },
  ],
};

const rowACash: ComparisonRow = {
  id: "offer-a:cash",
  label: "A, cash",
  offerId: "offer-a",
  supplierName: "Al-Noor Industrial Machines",
  method: "cash",
  financingId: null,
  cashPrice: 55_20_000,
  upfront: 55_20_000,
  monthlyPayment: 0,
  months: 0,
  totalPaid: 55_20_000,
  pvBeforeTax: 55_20_000,
  pvAfterTax: 44_20_541,
  runwayMonths: 1.28,
  hiddenYearlyRate: null,
  hiddenSimpleRate: null,
  verdict: "Salaries at risk",
  recommended: false,
  calculation: [
    {
      label: "Cash price after discount",
      formula: "list total × (1 − cash discount)",
      inputs: { listTotal: 60_00_000, cashDiscount: 0.08 },
      result: 55_20_000,
    },
  ],
};

const rowAInstallments: ComparisonRow = {
  id: "offer-a:installments",
  label: 'A, "0%" installments',
  offerId: "offer-a",
  supplierName: "Al-Noor Industrial Machines",
  method: "installments",
  financingId: null,
  cashPrice: 55_20_000,
  upfront: 0,
  monthlyPayment: 5_00_000,
  months: 12,
  totalPaid: 60_00_000,
  pvBeforeTax: 55_67_038,
  pvAfterTax: 44_87_290,
  runwayMonths: 2.5,
  hiddenYearlyRate: 0.16858,
  hiddenSimpleRate: hiddenMonthly * 12,
  verdict: "Hidden 16.9% a year",
  recommended: false,
  calculation: [
    {
      label: "Hidden monthly rate",
      formula: "cash price = Σ installment / (1 + r)^t, t = 1…n",
      inputs: { cashPrice: 55_20_000, installment: 5_00_000, months: 12 },
      result: hiddenMonthly,
    },
    {
      label: "Hidden yearly rate",
      formula: "(1 + r)^12 − 1",
      inputs: { r: hiddenMonthly },
      result: 0.16858,
    },
  ],
};

export const demoDecision: DecideResult = {
  // sorted by pvAfterTax ascending
  rows: [rowLtff, rowBCash, rowBank, rowACash, rowAInstallments],
  recommendedId: "offer-b:ltff",
  baselineId: "offer-a:installments",
  savingsVsBaseline: { beforeTax: 5_79_103, afterTax: 4_73_603 },
  runwayToday: 2.857142857142857,
  breakEvenDiscountRate: 0.0884,
  afterTaxDiscountRate: 0.1065,
  kiborShift: 0,
  assumptions: [
    "Bank processing fees, insurance and collateral are not included (fee set to 0).",
    "LTFF needs an exporter buying new machinery; the bank confirms eligibility.",
    "LTFF approval takes several weeks; the bank confirms the timeline.",
    "Runway counts no sales income, so it is a floor.",
  ],
  company: demoCompany,
};
