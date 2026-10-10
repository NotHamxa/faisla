// Finance engine tests: every case in TECHNICAL_SPEC.md §4.6 plus the full §4.5 table (Islamic-first wording:
// Islamic LTFF / Diminishing Musharakah carry the spec's LTFF / bank numbers), plus Ijarah and the preference rules.
import { describe, expect, it } from "vitest";
import { conventionalBankLoan, demoCompany, demoFinancing, demoOfferA, demoOfferB, ijarah, murabaha } from "./demoData";
import {
  amortisation,
  breakEvenDiscountRate,
  buildOptions,
  compareOptions,
  decide,
  emi,
  hiddenMonthlyRate,
  isShariahRow,
  monthlyFromYearly,
  offerCashPrice,
  postTransferDepreciation,
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
    { id: "offer-a:installments", label: 'A, deferred-price plan ("0%")', pre: 55_67_038, post: 44_87_290, runway: 2.5, verdict: "Paying later costs 16.9% a year" },
    { id: "offer-a:cash", label: "A, cash", pre: 55_20_000, post: 44_20_541, runway: 1.28, verdict: "Salaries at risk" },
    { id: "offer-b:cash", label: "B, cash", pre: 53_60_000, post: 42_92_409, runway: 1.33, verdict: "Cheapest price, drains cash" },
    { id: "offer-b:dm", label: "B, Diminishing Musharakah 14.8%", pre: 54_11_012, post: 43_32_522, runway: 2.58, verdict: "Safe, dearer than Islamic LTFF" },
    { id: "offer-b:ijarah", label: "B, Ijarah 14.8%", pre: 54_11_012, post: 41_90_272, runway: 2.58, verdict: "Safe, dearer than Islamic LTFF" },
    { id: "offer-b:iltf", label: "B, Islamic LTFF 8.5%", pre: 49_87_935, post: 40_13_687, runway: 2.59, verdict: "Recommended" },
  ];

  it("has exactly the six Shariah-compliant rows, sorted by PV after tax", () => {
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
    expect(groupPKR(row("offer-b:iltf").pvBeforeTax)).toBe("49,87,935");
    expect(groupPKR(row("offer-b:iltf").pvAfterTax)).toBe("40,13,687");
    expect(groupPKR(row("offer-a:installments").pvBeforeTax)).toBe("55,67,038");
    expect(groupPKR(row("offer-a:installments").pvAfterTax)).toBe("44,87,290");
  });

  it("pay columns", () => {
    const inst = row("offer-a:installments");
    expect([inst.upfront, inst.months, inst.monthlyPayment]).toEqual([0, 12, 5_00_000]);
    expect(row("offer-a:cash").upfront).toBe(55_20_000);
    expect(row("offer-b:cash").upfront).toBe(53_60_000);
    const ltff = row("offer-b:iltf");
    expect(ltff.upfront).toBeCloseTo(5_36_000, 6);
    expect(ltff.months).toBe(36);
    expect(groupPKR(ltff.monthlyPayment)).toBe("1,52,282");
    expect(groupPKR(row("offer-b:dm").monthlyPayment)).toBe("1,66,753");
  });

  it("hidden rate on the installment row", () => {
    const inst = row("offer-a:installments");
    expect(inst.hiddenYearlyRate).toBeCloseTo(0.1686, 4);
    expect(inst.hiddenSimpleRate).toBeCloseTo(0.013067 * 12, 4);
    expect(row("offer-a:cash").hiddenYearlyRate).toBeNull();
  });

  it("recommends Islamic LTFF and measures savings against the quoted plan", () => {
    expect(result.recommendedId).toBe("offer-b:iltf");
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
    expect(row("offer-a:installments").calculation.map((s) => s.label)).toContain("Effective yearly cost");
    expect(row("offer-b:iltf").calculation.map((s) => s.label)).toContain("Monthly installment");
  });

  it("assumptions cover fees, LTFF, runway and depreciation", () => {
    const text = result.assumptions.join(" ");
    for (const word of ["fee", "Insurance", "collateral", "LTFF", "4–8 weeks", "floor", "arrears", "Scrap", "initial allowance"]) {
      expect(text).toContain(word);
    }
  });
});

describe("break-even discount rate", () => {
  it("Islamic LTFF beats B cash above 8.84% a year", () => {
    expect(Math.abs(result.breakEvenDiscountRate! - 0.0884)).toBeLessThanOrEqual(0.0005);
    const options = buildOptions(demoCompany, [demoOfferA, demoOfferB], demoFinancing);
    const ltff = options.find((o) => o.id === "offer-b:iltf")!;
    const be = breakEvenDiscountRate(ltff, offerCashPrice(demoOfferB))!;
    expect(Math.abs(be - 0.0884)).toBeLessThanOrEqual(0.0005);
  });
});

describe("stress test (KIBOR +2%)", () => {
  const stressed = decide({ ...input, kiborShift: 0.02 });
  const bank = stressed.rows.find((r) => r.id === "offer-b:dm")!;

  it("re-prices Diminishing Musharakah at 16.8%", () => {
    expect(bank.label).toBe("B, Diminishing Musharakah 16.8%");
    expect(Math.abs(bank.monthlyPayment - 1_71_509)).toBeLessThanOrEqual(1);
    expect(Math.abs(bank.pvBeforeTax - 55_50_038)).toBeLessThanOrEqual(5);
  });

  it("leaves Islamic LTFF and the recommendation unchanged", () => {
    const ltff = stressed.rows.find((r) => r.id === "offer-b:iltf")!;
    expect(Math.abs(ltff.monthlyPayment - row("offer-b:iltf").monthlyPayment)).toBeLessThan(1e-6);
    expect(stressed.recommendedId).toBe(result.recommendedId);
    expect(stressed.kiborShift).toBe(0.02);
  });

  it("stressTest() matches decide() with a shift", () => {
    const options = buildOptions(demoCompany, [demoOfferA, demoOfferB], demoFinancing);
    const rows = stressTest(options, 0.02, demoCompany);
    expect(rows.find((r) => r.id === "offer-b:dm")!.pvBeforeTax).toBeCloseTo(bank.pvBeforeTax, 6);
    expect(compareOptions(options, demoCompany).find((r) => r.recommended)!.id).toBe("offer-b:iltf");
  });
});

describe("eligibility and fees", () => {
  it("drops Islamic LTFF for a non-exporter and recommends Ijarah (rentals deductible as paid)", () => {
    const r = decide({ ...input, company: { ...demoCompany, isExporter: false } });
    expect(r.rows.some((x) => x.method === "iltf" || x.method === "ltff")).toBe(false);
    expect(r.recommendedId).toBe("offer-b:ijarah");
  });

  it("without Ijarah, a non-exporter gets Diminishing Musharakah (the spec's bank row)", () => {
    const financing = demoFinancing.filter((f) => f.type !== "ijarah");
    const r = decide({ ...input, financing, company: { ...demoCompany, isExporter: false } });
    expect(r.recommendedId).toBe("offer-b:dm");
    expect(Math.abs(r.rows.find((x) => x.id === "offer-b:dm")!.pvAfterTax - 43_32_522)).toBeLessThanOrEqual(5);
  });

  it("adds the processing fee to the upfront payment", () => {
    const financing = demoFinancing.map((f) => ({ ...f, feePct: 0.01 }));
    const r = decide({ ...input, financing });
    const ltff = r.rows.find((x) => x.id === "offer-b:iltf")!;
    expect(ltff.upfront).toBeCloseTo(5_36_000 + 48_240, 6);
    expect(ltff.pvBeforeTax).toBeGreaterThan(row("offer-b:iltf").pvBeforeTax);
  });
});

describe("financing preference (Islamic finance first)", () => {
  it("islamic preference (the default) excludes conventional financing", () => {
    expect(demoCompany.financingPreference).toBe("islamic");
    expect(result.financingPreference).toBe("islamic");
    expect(result.rows.some((r) => r.method === "bank" || r.method === "ltff")).toBe(false);
    expect(result.rows.every((r) => r.shariahCompliant === true)).toBe(true);
    const words = result.rows.map((r) => `${r.label} ${r.verdict}`).join(" ");
    expect(words).not.toMatch(/interest|loan|markup|EMI/i);
  });

  it("a company without a preference (old record) is treated as islamic", () => {
    const old = { ...demoCompany } as Partial<typeof demoCompany>;
    delete old.financingPreference;
    const r = decide({ ...input, company: old as typeof demoCompany });
    expect(r.rows.some((x) => x.method === "bank" || x.method === "ltff")).toBe(false);
  });

  it("both: conventional rows appear, labelled, never recommended; numbers unchanged", () => {
    const both = decide({ ...input, preference: "both" });
    const bank = both.rows.find((r) => r.id === "offer-b:bank")!;
    const ltff = both.rows.find((r) => r.id === "offer-b:ltff")!;
    expect(bank.label).toBe("B, conventional loan 14.8%");
    expect(ltff.label).toBe("B, conventional LTFF 8.5%");
    for (const r of [bank, ltff]) {
      expect(r.shariahCompliant).toBe(false);
      expect(isShariahRow(r)).toBe(false);
      expect(r.recommended).toBe(false);
      expect(r.verdict).toBe("Interest-based, for comparison only");
    }
    expect(Math.abs(ltff.pvAfterTax - 40_13_687)).toBeLessThanOrEqual(5);
    expect(Math.abs(bank.pvAfterTax - 43_32_522)).toBeLessThanOrEqual(5);
    expect(both.recommendedId).toBe("offer-b:iltf");
    expect(both.rows).toHaveLength(8);
  });

  it("never recommends conventional financing, even when it is the cheapest", () => {
    const cheap = { ...conventionalBankLoan, id: "cheap", annualRate: 0.01 };
    const financing = [...demoFinancing, cheap];
    const islamicOnly = decide({ ...input, financing });
    expect(islamicOnly.rows.some((r) => r.financingId === "cheap")).toBe(false);
    const both = decide({ ...input, financing, preference: "both" });
    const cheapRow = both.rows.find((r) => r.financingId === "cheap")!;
    expect(cheapRow.pvAfterTax).toBeLessThan(both.rows.find((r) => r.recommended)!.pvAfterTax);
    expect(cheapRow.recommended).toBe(false);
    expect(isShariahRow(both.rows.find((r) => r.recommended)!)).toBe(true);
    expect(both.recommendedId).toBe("offer-b:iltf");
  });

  it("rows saved before the flag existed are classified by method", () => {
    expect(isShariahRow({ method: "ltff" })).toBe(false);
    expect(isShariahRow({ method: "bank" })).toBe(false);
    expect(isShariahRow({ method: "installments" })).toBe(true);
    expect(isShariahRow({ method: "iltf" })).toBe(true);
  });

  it("Murabaha uses the same installment maths but its fixed price is not KIBOR-shifted", () => {
    const financing = [murabaha];
    const base = decide({ ...input, financing });
    const stressed = decide({ ...input, financing, kiborShift: 0.02 });
    const m = base.rows.find((r) => r.id === "offer-b:murabaha")!;
    expect(m.label).toBe("B, Murabaha 14.8%");
    expect(Math.abs(m.pvBeforeTax - 54_11_012)).toBeLessThanOrEqual(5);
    expect(Math.abs(m.pvAfterTax - 43_32_522)).toBeLessThanOrEqual(5);
    expect(stressed.rows.find((r) => r.id === "offer-b:murabaha")!.monthlyPayment).toBeCloseTo(m.monthlyPayment, 6);
  });
});

describe("Ijarah after-tax treatment", () => {
  const ij = row("offer-b:ijarah");
  const options = buildOptions(demoCompany, [demoOfferA, demoOfferB], demoFinancing);
  const opt = options.find((o) => o.id === "offer-b:ijarah")!;

  it("pays a 10% security deposit, then rentals at the benchmark rate", () => {
    expect(ij.upfront).toBeCloseTo(5_36_000, 6);
    expect(ij.months).toBe(36);
    expect(Math.abs(ij.monthlyPayment - emi(48_24_000, ijarah.annualRate, 36))).toBeLessThan(1e-6);
    expect(groupPKR(ij.monthlyPayment)).toBe("1,66,753");
  });

  it("adjusts the deposit against the purchase price at the end (net nil cash flow)", () => {
    const end = opt.flows.filter((f) => f.month === 36).map((f) => f.amount);
    expect(end).toEqual(expect.arrayContaining([-5_36_000, 5_36_000]));
    expect(ij.totalPaid).toBeCloseTo(5_36_000 + 36 * ij.monthlyPayment, 4);
    expect(Math.abs(ij.pvBeforeTax - row("offer-b:dm").pvBeforeTax)).toBeLessThan(1e-6);
  });

  it("deducts every rental as paid and claims no depreciation during the lease", () => {
    for (let m = 1; m <= 36; m++) expect(opt.markupByMonth.get(m)).toBeCloseTo(ij.monthlyPayment, 6);
    const dep = postTransferDepreciation(5_36_000, 36);
    expect(dep.slice(0, 3)).toEqual([0, 0, 0]);
    expect(dep[3]).toBeCloseTo(80_400, 6); // 15% of the purchase price, no initial allowance
    expect(dep.reduce((s, d) => s + d, 0)).toBeCloseTo(5_36_000, 6);
    expect(opt.depreciationByYear).toEqual(dep);
  });

  it("after-tax PV matches an independent calculation (41,90,272)", () => {
    const flows = [{ month: 0, amount: 5_36_000 }];
    for (let m = 1; m <= 36; m++) flows.push({ month: m, amount: ij.monthlyPayment });
    const dep = postTransferDepreciation(5_36_000, 36);
    for (let y = 1; y <= 10; y++) {
      const deductible = (y <= 3 ? 12 * ij.monthlyPayment : 0) + dep[y - 1];
      flows.push({ month: 12 * y, amount: -deductible * demoCompany.taxRate });
    }
    const expected = presentValue(flows, demoCompany.discountRate * (1 - demoCompany.taxRate));
    expect(Math.abs(ij.pvAfterTax - expected)).toBeLessThan(0.01);
    expect(Math.abs(ij.pvAfterTax - 41_90_272)).toBeLessThanOrEqual(5);
  });

  it("is cheaper after tax than Diminishing Musharakah at the same rate (faster deductions)", () => {
    expect(ij.pvAfterTax).toBeLessThan(row("offer-b:dm").pvAfterTax);
    expect(ij.calculation.map((s) => s.label)).toEqual(
      expect.arrayContaining(["Security deposit", "Monthly rental", "End of lease", "Tax depreciation (after transfer)"]),
    );
  });
});
