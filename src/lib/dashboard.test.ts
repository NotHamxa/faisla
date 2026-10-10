// Dashboard tests on the seeded demo shape: one decided JUKI purchase (Islamic LTFF), one open generator quote, one draft.
import { describe, expect, it } from "vitest";
import { addMonths, buildDashboard } from "./dashboard";
import { demoCompany, demoFinancing, demoOfferA, demoOfferB, demoQuotation } from "./demoData";
import { decide } from "./finance";
import type { CompanyRecord, DecisionRecord, Offer } from "./types";

const now = new Date("2026-10-10T09:00:00.000Z");
const company: CompanyRecord = { ...demoCompany, id: "c1", financing: demoFinancing, updatedAt: now.toISOString() };

function record(over: Partial<DecisionRecord> & Pick<DecisionRecord, "id" | "title" | "status">): DecisionRecord {
  return {
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    decidedAt: null,
    origin: "quotation",
    paymentConfirmations: [],
    quotation: null,
    quotationConfirmed: false,
    sourcing: null,
    offers: [],
    market: null,
    reputations: {},
    suppliers: [],
    emails: [],
    decision: null,
    memo: null,
    ...over,
  };
}

const jukiDecision = decide({ company, offers: [demoOfferA, demoOfferB], financing: demoFinancing });
const juki = record({
  id: "juki",
  title: "80 × Jack F5 lockstitch machines",
  status: "decided",
  decidedAt: "2026-10-07T09:00:00.000Z",
  updatedAt: "2026-10-07T09:00:00.000Z",
  quotation: demoQuotation,
  quotationConfirmed: true,
  offers: [demoOfferA, demoOfferB],
  decision: jukiDecision,
  memo: { memo: "memo", numberCheck: { passed: true, unknownNumbers: [], attempts: 0 }, source: "template" },
});

const generatorOffer: Offer = {
  id: "offer-a",
  supplierName: "Faisal Power Systems",
  supplierEmail: "info@faisalpower.pk",
  item: "Diesel generator",
  model: "Cummins C110D5",
  qty: 1,
  unitPrice: 38_00_000,
  total: 38_00_000,
  cashDiscountPct: 5,
  installmentMonths: 6,
  installmentAmount: 6_80_000,
  firstInstallmentOnDelivery: true,
  source: "quote",
  sourceLink: null,
  receivedAt: "2026-10-09T09:00:00.000Z",
};
const generator = record({
  id: "gen",
  title: "100 kVA backup generator",
  status: "collecting",
  updatedAt: "2026-10-09T09:00:00.000Z",
  quotation: { ...demoQuotation, supplierName: "Faisal Power Systems", quoteDate: "2026-10-09", validityDays: 10 },
  quotationConfirmed: true,
  offers: [generatorOffer],
});
const draft = record({ id: "draft", title: "Fabric cutting machine (draft)", status: "draft", updatedAt: "2026-10-10T07:00:00.000Z" });

const decisions = [draft, generator, juki];
const dash = buildDashboard(company, decisions, now);
const ltff = jukiDecision.rows.find((r) => r.recommended)!;

describe("kpis", () => {
  it("recommends Islamic LTFF for the demo purchase", () => {
    expect(ltff.method).toBe("iltf");
  });

  it("runway today = cash ÷ fixed costs", () => {
    expect(dash.kpis.cashBalance).toBe(1_00_00_000);
    expect(dash.kpis.runwayToday).toBeCloseTo(1_00_00_000 / 35_00_000, 6);
  });

  it("runway after commitments = LTFF row's runway (~2.59 months)", () => {
    expect(dash.kpis.committedUpfront).toBeCloseTo(ltff.upfront, 2);
    expect(dash.kpis.committedMonthly).toBeCloseTo(ltff.monthlyPayment, 2);
    expect(dash.kpis.runwayAfterCommitments).toBeCloseTo(ltff.runwayMonths, 6);
    expect(dash.kpis.runwayAfterCommitments).toBeCloseTo(2.59, 2);
  });

  it("savings found = the decided memo's savings (5.8 lakh, 4.7 lakh after tax)", () => {
    expect(dash.kpis.savingsFoundBeforeTax).toBe(jukiDecision.savingsVsBaseline!.beforeTax);
    expect(dash.kpis.savingsFoundAfterTax).toBe(jukiDecision.savingsVsBaseline!.afterTax);
    expect(dash.kpis.savingsFoundBeforeTax).toBeGreaterThan(5_70_000);
    expect(dash.kpis.savingsFoundAfterTax).toBeGreaterThan(4_60_000);
  });

  it("counts open and decided decisions", () => {
    expect(dash.kpis.openDecisions).toBe(2);
    expect(dash.kpis.decidedCount).toBe(1);
  });
});

describe("upcoming payments", () => {
  it("first LTFF EMI is one month after the decision; next 6 in order", () => {
    expect(dash.upcomingPayments).toHaveLength(6);
    expect(dash.upcomingPayments[0]).toMatchObject({ decisionId: "juki", label: "Islamic LTFF installment 1 of 36", dueDate: "2026-11-07T09:00:00.000Z" });
    expect(dash.upcomingPayments[0].amount).toBeCloseTo(ltff.monthlyPayment, 2);
    expect(dash.upcomingPayments[5].label).toBe("Islamic LTFF installment 6 of 36");
  });

  it("installments due on delivery start at the decision date", () => {
    const decidedGen = { ...generator, id: "gen2", status: "decided" as const, decidedAt: "2026-10-10T08:00:00.000Z" };
    decidedGen.decision = decide({ company: { ...company, cashBalance: 10_00_000 }, offers: [generatorOffer], financing: [] });
    // Force the installment row as the chosen one to check timing.
    const inst = decidedGen.decision.rows.find((r) => r.method === "installments")!;
    decidedGen.decision = { ...decidedGen.decision, recommendedId: inst.id };
    const d = buildDashboard(company, [decidedGen], new Date("2026-10-10T00:00:00.000Z"));
    expect(d.upcomingPayments[0]).toMatchObject({ label: "Installment 1 of 6", dueDate: "2026-10-10T08:00:00.000Z" });
  });

  it("addMonths clamps to the month end", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00.000Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("cash projection", () => {
  it("has 12 calendar months from this one with committed EMIs", () => {
    expect(dash.cashProjection).toHaveLength(12);
    expect(dash.cashProjection[0]).toMatchObject({ month: "2026-10", label: "Oct", committed: 0 });
    expect(dash.cashProjection[1].committed).toBeCloseTo(ltff.monthlyPayment, 2);
  });

  it("cash floor falls by fixed costs + EMIs (no sales)", () => {
    const start = 1_00_00_000 - ltff.upfront;
    expect(dash.cashProjection[0].cashFloor).toBeCloseTo(start - 35_00_000, 2);
    expect(dash.cashProjection[1].cashFloor).toBeCloseTo(start - 70_00_000 - ltff.monthlyPayment, 2);
  });
});

describe("alerts", () => {
  it("flags the cost of paying later on the generator's '0%' plan", () => {
    const a = dash.alerts.find((x) => x.title.includes("paying later"));
    expect(a).toBeDefined();
    expect(a!.level).toBe("high");
    expect(a!.href).toBe("/decisions/gen");
  });

  it("asks for the LTFF term sheet until one is sent", () => {
    expect(dash.alerts.some((a) => a.title === "Request the Islamic LTFF term sheet" && a.href === "/decisions/juki")).toBe(true);
    const sent = {
      ...juki,
      emails: [
        { id: "e1", direction: "out" as const, toFrom: "bank@x.pk", subject: "Term sheet request: LTFF", body: "", offerId: null, sentAt: now.toISOString(), simulated: true },
      ],
    };
    const d = buildDashboard(company, [sent], now);
    expect(d.alerts.some((a) => a.title.startsWith("Request the"))).toBe(false);
  });

  it("does not flag the decided purchase's installment baseline", () => {
    expect(dash.alerts.some((a) => a.href === "/decisions/juki" && a.title.includes("paying later"))).toBe(false);
  });

  it("warns when runway after commitments is below 2 months", () => {
    const poorer = buildDashboard({ ...company, cashBalance: 60_00_000 }, [juki], now);
    expect(poorer.alerts[0].level).toBe("high");
    expect(poorer.alerts[0].title).toMatch(/^Runway drops/);
    expect(dash.alerts.some((a) => a.title.startsWith("Runway drops"))).toBe(false);
  });

  it("warns about quotations expiring within 5 days", () => {
    expect(dash.alerts.some((a) => a.title.startsWith("Quotation expires"))).toBe(false);
    const later = buildDashboard(company, decisions, new Date("2026-10-16T09:00:00.000Z"));
    expect(later.alerts.some((a) => a.title === "Quotation expires in 3 days")).toBe(true);
  });

  it("flags red reputations on open decisions", () => {
    const flagged = {
      ...generator,
      reputations: {
        "Faisal Power Systems": {
          supplierName: "Faisal Power Systems",
          model: null,
          flag: "red" as const,
          averageRating: 2.1,
          reviews: [],
          reasons: ["3 buyers report warranty refused"],
          cached: true,
        },
      },
    };
    const d = buildDashboard(company, [flagged], now);
    expect(d.alerts.some((a) => a.title === "Red flag on Faisal Power Systems" && a.detail.includes("warranty"))).toBe(true);
  });
});

describe("recent decisions", () => {
  it("lists newest first with the recommended option and savings", () => {
    expect(dash.recentDecisions.map((d) => d.id)).toEqual(["draft", "gen", "juki"]);
    const j = dash.recentDecisions[2];
    expect(j.recommendedLabel).toBe(ltff.label);
    expect(j.savingsAfterTax).toBe(jukiDecision.savingsVsBaseline!.afterTax);
    expect(dash.recentDecisions[0].recommendedLabel).toBeNull();
  });
});
