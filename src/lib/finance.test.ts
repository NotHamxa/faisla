// Finance engine tests: every case in TECHNICAL_SPEC.md §4.6 plus the full §4.5 table.
import { describe, expect, it } from "vitest";
import { demoCompany, demoFinancing, demoOfferA, demoOfferB } from "./demoData";
import {
  amortisation,
  breakEvenDiscountRate,
  buildOptions,
  compareOptions,
  decide,
  emi,
  hiddenMonthlyRate,
  monthlyFromYearly,
  offerCashPrice,
  presentValue,
  runwayMonths,
  stressTest,
  taxDepreciation,
  yearlyFromMonthly,
} from "./finance";
import { groupPKR } from "./format";
import type { DecideInput } from "./types";

const input: DecideInput = { company: demoCompany, offers: [demoOfferA, demoOfferB], financing: demoFinancing };
const result = decide(input);
const row = (id: string) => {
  const r = result.rows.find((x) => x.id === id);
  if (!r) throw new Error(`missing row ${id}`);
  return r;
};

describe("rates", () => {
  it("converts yearly ↔ monthly", () => {
    expect(monthlyFromYearly(0.15)).toBeCloseTo(0.011715, 6);
    expect(yearlyFromMonthly(monthlyFromYearly(0.1065))).toBeCloseTo(0.1065, 10);
  });

  it("hidden rate, arrears: 1.3067% a month (16.86% a year)", () => {
    const r = hiddenMonthlyRate(55_20_000, 5_00_000, 12, false);
    expect(Math.abs(r - 0.013067)).toBeLessThan(0.00001);
    expect(yearlyFromMonthly(r)).toBeCloseTo(0.1686, 4);
  });

  it("hidden rate, first due on delivery: 1.5537% a month (20.32% a year)", () => {
    const r = hiddenMonthlyRate(55_20_000, 5_00_000, 12, true);
    expect(Math.abs(r - 0.015537)).toBeLessThan(0.00001);
    expect(yearlyFromMonthly(r)).toBeCloseTo(0.2032, 4);
  });

  it("hidden rate is 0 when installments don't exceed the cash price", () => {
    expect(hiddenMonthlyRate(60_00_000, 5_00_000, 12, false)).toBe(0);
  });
});

describe("loan", () => {
  it.each([
    [0.148, 1_66_753],
    [0.085, 1_52_282],
    [0.168, 1_71_509],
  ])("emi(48,24,000, %d, 36) ≈ %d", (rate, expected) => {
    expect(Math.abs(emi(48_24_000, rate, 36) - expected)).toBeLessThanOrEqual(1);
  });

  it("amortisation pays the loan down to zero", () => {
    const s = amortisation(48_24_000, 0.085, 36);
    expect(s).toHaveLength(36);
    expect(Math.abs(s[35].balance)).toBeLessThan(0.01);
    expect(s[0].markup).toBeCloseTo((48_24_000 * 0.085) / 12, 6);
  });
});

describe("tax depreciation", () => {
  it("53,60,000: year 1, 2, 10 = 19,43,000 · 5,12,550 · 9,31,100", () => {
    const d = taxDepreciation(53_60_000, { initialAllowance: 0.25, rate: 0.15, lifeYears: 10 });
    expect(d).toHaveLength(10);
    expect(Math.abs(d[0] - 19_43_000)).toBeLessThanOrEqual(1);
    expect(Math.abs(d[1] - 5_12_550)).toBeLessThanOrEqual(1);
    expect(Math.abs(d[9] - 9_31_100)).toBeLessThanOrEqual(1);
    expect(d.reduce((s, x) => s + x, 0)).toBeCloseTo(53_60_000, 4);
  });
});

describe("present value & runway", () => {
  it("PV of a month-0 flow is the flow itself", () => {
    expect(presentValue([{ month: 0, amount: 100 }], 0.15)).toBe(100);
  });

  it("runway formula", () => {
    expect(runwayMonths(1_00_00_000, 0, 35_00_000, 0)).toBeCloseTo(2.857, 3);
  });
});

describe("comparison table (spec §4.5)", () => {
  const expected = [
    { id: "offer-a:installments", label: 'A, "0%" installments', pre: 55_67_038, post: 44_87_290, runway: 2.5, verdict: "Hidden 16.9% a year" },
    { id: "offer-a:cash", label: "A, cash", pre: 55_20_000, post: 44_20_541, runway: 1.28, verdict: "Salaries at risk" },
    { id: "offer-b:cash", label: "B, cash", pre: 53_60_000, post: 42_92_409, runway: 1.33, verdict: "Cheapest price, drains cash" },
    { id: "offer-b:bank", label: "B, bank 14.8%", pre: 54_11_012, post: 43_32_522, runway: 2.58, verdict: "Safe, dearer than LTFF" },
    { id: "offer-b:ltff", label: "B, LTFF 8.5%", pre: 49_87_935, post: 40_13_687, runway: 2.59, verdict: "Recommended" },
  ];

  it("has exactly the five rows, sorted by PV after tax", () => {
    expect(result.rows.map((r) => r.id).sort()).toEqual(expected.map((e) => e.id).sort());
    const pvs = result.rows.map((r) => r.pvAfterTax);
    expect([...pvs].sort((a, b) => a - b)).toEqual(pvs);
  });

  it.each(expected)("$label", (e) => {
    const r = row(e.id);
    expect(r.label).toBe(e.label);
    expect(Math.abs(r.pvBeforeTax - e.pre)).toBeLessThanOrEqual(5);
    expect(Math.abs(r.pvAfterTax - e.post)).toBeLessThanOrEqual(5);
    expect(Math.abs(r.runwayMonths - e.runway)).toBeLessThanOrEqual(0.01);
    expect(r.verdict).toBe(e.verdict);
  });

  it("displays the spec's rounded figures", () => {
    expect(groupPKR(row("offer-b:ltff").pvBeforeTax)).toBe("49,87,935");
    expect(groupPKR(row("offer-b:ltff").pvAfterTax)).toBe("40,13,687");
    expect(groupPKR(row("offer-a:installments").pvBeforeTax)).toBe("55,67,038");
    expect(groupPKR(row("offer-a:installments").pvAfterTax)).toBe("44,87,290");
  });

  it("pay columns", () => {
    const inst = row("offer-a:installments");
    expect([inst.upfront, inst.months, inst.monthlyPayment]).toEqual([0, 12, 5_00_000]);
    expect(row("offer-a:cash").upfront).toBe(55_20_000);
    expect(row("offer-b:cash").upfront).toBe(53_60_000);
    const ltff = row("offer-b:ltff");
    expect(ltff.upfront).toBeCloseTo(5_36_000, 6);
    expect(ltff.months).toBe(36);
    expect(groupPKR(ltff.monthlyPayment)).toBe("1,52,282");
    expect(groupPKR(row("offer-b:bank").monthlyPayment)).toBe("1,66,753");
  });

  it("hidden rate on the installment row", () => {
    const inst = row("offer-a:installments");
    expect(inst.hiddenYearlyRate).toBeCloseTo(0.1686, 4);
    expect(inst.hiddenSimpleRate).toBeCloseTo(0.013067 * 12, 4);
    expect(row("offer-a:cash").hiddenYearlyRate).toBeNull();
  });

  it("recommends LTFF and measures savings against the quoted plan", () => {
    expect(result.recommendedId).toBe("offer-b:ltff");
    expect(result.baselineId).toBe("offer-a:installments");
    expect(Math.abs(result.savingsVsBaseline!.beforeTax - 5_79_103)).toBeLessThanOrEqual(5);
    expect(Math.abs(result.savingsVsBaseline!.afterTax - 4_73_603)).toBeLessThanOrEqual(5);
  });

  it("runway today 2.86 months", () => {
    expect(Math.abs(result.runwayToday - 2.86)).toBeLessThanOrEqual(0.01);
  });

  it("after-tax discount rate 10.65%", () => {
    expect(result.afterTaxDiscountRate).toBeCloseTo(0.1065, 10);
  });

  it("every row has a calculation with PV and runway steps", () => {
    for (const r of result.rows) {
      const labels = r.calculation.map((s) => s.label);
      expect(labels).toEqual(expect.arrayContaining(["PV before tax", "PV after tax", "Runway"]));
    }
    expect(row("offer-a:installments").calculation.map((s) => s.label)).toContain("Hidden yearly rate");
    expect(row("offer-b:ltff").calculation.map((s) => s.label)).toContain("Monthly payment (EMI)");
  });

  it("assumptions cover fees, LTFF, runway and depreciation", () => {
    const text = result.assumptions.join(" ");
    for (const word of ["fee", "Insurance", "collateral", "LTFF", "4–8 weeks", "floor", "arrears", "Scrap", "initial allowance"]) {
      expect(text).toContain(word);
    }
  });
});

describe("break-even discount rate", () => {
  it("LTFF beats B cash above 8.84% a year", () => {
    expect(Math.abs(result.breakEvenDiscountRate! - 0.0884)).toBeLessThanOrEqual(0.0005);
    const options = buildOptions(demoCompany, [demoOfferA, demoOfferB], demoFinancing);
    const ltff = options.find((o) => o.id === "offer-b:ltff")!;
    const be = breakEvenDiscountRate(ltff, offerCashPrice(demoOfferB))!;
    expect(Math.abs(be - 0.0884)).toBeLessThanOrEqual(0.0005);
  });
});

describe("stress test (KIBOR +2%)", () => {
  const stressed = decide({ ...input, kiborShift: 0.02 });
  const bank = stressed.rows.find((r) => r.id === "offer-b:bank")!;

  it("re-prices the bank loan at 16.8%", () => {
    expect(bank.label).toBe("B, bank 16.8%");
    expect(Math.abs(bank.monthlyPayment - 1_71_509)).toBeLessThanOrEqual(1);
    expect(Math.abs(bank.pvBeforeTax - 55_50_038)).toBeLessThanOrEqual(5);
  });

  it("leaves LTFF and the recommendation unchanged", () => {
    const ltff = stressed.rows.find((r) => r.id === "offer-b:ltff")!;
    expect(Math.abs(ltff.monthlyPayment - row("offer-b:ltff").monthlyPayment)).toBeLessThan(1e-6);
    expect(stressed.recommendedId).toBe(result.recommendedId);
    expect(stressed.kiborShift).toBe(0.02);
  });

  it("stressTest() matches decide() with a shift", () => {
    const options = buildOptions(demoCompany, [demoOfferA, demoOfferB], demoFinancing);
    const rows = stressTest(options, 0.02, demoCompany);
    expect(rows.find((r) => r.id === "offer-b:bank")!.pvBeforeTax).toBeCloseTo(bank.pvBeforeTax, 6);
    expect(compareOptions(options, demoCompany).find((r) => r.recommended)!.id).toBe("offer-b:ltff");
  });
});

describe("eligibility and fees", () => {
  it("drops LTFF for a non-exporter and recommends the bank loan", () => {
    const r = decide({ ...input, company: { ...demoCompany, isExporter: false } });
    expect(r.rows.some((x) => x.method === "ltff")).toBe(false);
    expect(r.recommendedId).toBe("offer-b:bank");
  });

  it("adds the processing fee to the upfront payment", () => {
    const financing = demoFinancing.map((f) => ({ ...f, feePct: 0.01 }));
    const r = decide({ ...input, financing });
    const ltff = r.rows.find((x) => x.id === "offer-b:ltff")!;
    expect(ltff.upfront).toBeCloseTo(5_36_000 + 48_240, 6);
    expect(ltff.pvBeforeTax).toBeGreaterThan(row("offer-b:ltff").pvBeforeTax);
  });
});
