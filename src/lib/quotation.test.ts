import { describe, expect, it } from "vitest";
import { demoOfferA, demoQuotation } from "./demoData";
import { checkArithmetic, emptyQuotation, quotationCashPrice, quotationListTotal, quotationToOffer } from "./quotation";
import type { Quotation } from "./types";

describe("checkArithmetic", () => {
  it("demo quotation: totals add up, only the '0%' installment plan is flagged", () => {
    const issues = checkArithmetic(demoQuotation);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe("installmentAmount");
    // 12 × 5,00,000 = 60,00,000 vs cash price 55,20,000 → 4,80,000 hidden cost
    expect(issues[0].message).toContain("Rs 60,00,000");
    expect(issues[0].message).toContain("Rs 4,80,000");
    expect(issues[0].message).toContain("Rs 55,20,000");
    expect(issues[0].message).toContain('"0% markup"');
  });

  it("computes list and cash price in code", () => {
    expect(quotationListTotal(demoQuotation)).toBe(60_00_000);
    expect(quotationCashPrice(demoQuotation)).toBe(55_20_000);
  });

  it("flags a printed line total and grand total that don't match qty × unit price", () => {
    const q: Quotation = {
      ...demoQuotation,
      items: [{ ...demoQuotation.items[0], lineTotal: 58_00_000 }],
      printedTotal: 58_00_000,
    };
    const fields = checkArithmetic(q).map((i) => i.field);
    expect(fields).toContain("items.0.lineTotal");
    expect(fields).toContain("printedTotal");
    const line = checkArithmetic(q).find((i) => i.field === "items.0.lineTotal")!;
    expect(line.message).toBe("4 × Rs 15,00,000 = Rs 60,00,000, but the quotation prints Rs 58,00,000.");
  });

  it("sums multiple lines against the printed total", () => {
    const q: Quotation = {
      ...demoQuotation,
      items: [
        { description: "Machine", model: null, qty: 2, unitPrice: 10_00_000, lineTotal: 20_00_000 },
        { description: "Stand", model: null, qty: 2, unitPrice: 50_000, lineTotal: 1_00_000 },
      ],
      printedTotal: 21_00_000,
      installmentMonths: null,
      installmentAmount: null,
    };
    expect(checkArithmetic(q)).toEqual([]);
    expect(checkArithmetic({ ...q, printedTotal: 20_00_000 }).map((i) => i.field)).toEqual(["printedTotal"]);
  });

  it("ignores null printed totals and accepts an honest installment plan", () => {
    const q: Quotation = {
      ...demoQuotation,
      items: [{ ...demoQuotation.items[0], lineTotal: null }],
      printedTotal: null,
      cashDiscountPct: null,
      installmentAmount: 5_00_000, // 12 × 5 lakh = 60 lakh = list price, no discount → truly 0%
    };
    expect(checkArithmetic(q)).toEqual([]);
  });

  it("flags an impossible cash discount and missing quantities/prices", () => {
    const fields = checkArithmetic({ ...demoQuotation, cashDiscountPct: 80 }).map((i) => i.field);
    expect(fields).toContain("cashDiscountPct");

    const blank = checkArithmetic(emptyQuotation()).map((i) => i.field);
    expect(blank).toContain("items.0.unitPrice");
    expect(checkArithmetic({ ...emptyQuotation(), items: [] }).map((i) => i.field)).toEqual(["items"]);
  });
});

describe("quotationToOffer", () => {
  it("demo quotation becomes demoOfferA", () => {
    const offer = quotationToOffer(demoQuotation);
    expect(offer).toEqual({ ...demoOfferA, receivedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(offer.receivedAt))).toBe(false);
  });

  it("total is qty × unit price, not the printed total", () => {
    const q: Quotation = {
      ...demoQuotation,
      items: [{ ...demoQuotation.items[0], qty: 3, lineTotal: 99 }],
      printedTotal: 99,
    };
    const offer = quotationToOffer(q, "offer-x");
    expect(offer.id).toBe("offer-x");
    expect(offer.qty).toBe(3);
    expect(offer.total).toBe(45_00_000);
  });

  it("unknown first-installment timing defaults to false", () => {
    expect(quotationToOffer({ ...demoQuotation, firstInstallmentOnDelivery: null }).firstInstallmentOnDelivery).toBe(false);
    expect(quotationToOffer({ ...demoQuotation, firstInstallmentOnDelivery: true }).firstInstallmentOnDelivery).toBe(true);
  });
});
