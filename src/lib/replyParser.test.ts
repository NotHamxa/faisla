import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_SUPPLIER_B_REPLY } from "./demoData";
import { buildReplyOffer, extractReply, hashString, parseAmounts, parseReplyText, stripQuoted } from "./replyParser";

describe("parseAmounts", () => {
  it("reads lakh, crore, Rs and grouped numbers", () => {
    expect(parseAmounts("13.4 lakh per unit")).toEqual([{ value: 13_40_000, kind: "unit", raw: "13.4 lakh" }]);
    expect(parseAmounts("total 5.36 crore")[0]).toMatchObject({ value: 5_36_00_000, kind: "total" });
    expect(parseAmounts("Rs. 1,340,000 each")[0]).toMatchObject({ value: 13_40_000, kind: "unit" });
    expect(parseAmounts("kul 53,60,000/-")[0]).toMatchObject({ value: 53_60_000, kind: "total" });
    expect(parseAmounts("13.5 lac")[0]).toMatchObject({ value: 13_50_000, kind: "unknown" });
  });

  it("ignores phone numbers", () => {
    expect(parseAmounts("Call 0300-1234567 or +92 42 3577 2210")).toEqual([]);
  });
});

describe("parseReplyText", () => {
  it("reads the demo Roman Urdu reply from supplier B", () => {
    const x = parseReplyText(DEMO_SUPPLIER_B_REPLY);
    expect(x.unitPrice).toBe(13_40_000);
    expect(x.qty).toBe(4);
    expect(x.deliveryDays).toBe(10);
    expect(x.warrantyMonths).toBe(12);
    expect(x.needsOwnerInput).toBeUndefined();
    expect(x.summary).toContain("13.4 lakh");
  });

  it("derives unit price from a written total and quantity", () => {
    const x = parseReplyText("Sir 4 machines ka total 53.6 lakh, 2 hafte mein delivery, warranty ek saal");
    expect(x.total).toBe(53_60_000);
    expect(x.unitPrice).toBe(13_40_000);
    expect(x.deliveryDays).toBe(14);
    expect(x.warrantyMonths).toBe(12);
  });

  it("handles English replies with Rs amounts", () => {
    const x = parseReplyText("Dear sir, price is Rs. 1,375,000 per machine. Delivery 7-10 days. Warranty 6 months. 50% advance, balance on delivery.");
    expect(x.unitPrice).toBe(13_75_000);
    expect(x.deliveryDays).toBe(10);
    expect(x.warrantyMonths).toBe(6);
    expect(x.paymentTerms).toContain("advance");
  });

  it("picks the right duration when warranty and delivery share a clause", () => {
    const x = parseReplyText("13.4 lakh per unit. 1 saal warranty aur delivery 10 din");
    expect(x.deliveryDays).toBe(10);
    expect(x.warrantyMonths).toBe(12);
  });

  it("uses the quoted price only to decide unit vs total for unlabelled amounts", () => {
    expect(parseReplyText("4 machines, 13.5 lakh final", { referenceUnitPrice: 15_00_000 }).unitPrice).toBe(13_50_000);
    const total = parseReplyText("4 machines 54 lakh final", { referenceUnitPrice: 15_00_000 });
    expect(total.total).toBe(54_00_000);
    expect(total.unitPrice).toBe(13_50_000);
  });

  it("returns null and asks the owner when the price is unclear", () => {
    const noPrice = parseReplyText("Bhai rate kal bata dunga, abhi stock check kar raha hun");
    expect(noPrice.unitPrice).toBeNull();
    expect(noPrice.needsOwnerInput).toBeTruthy();

    const ambiguous = parseReplyText("4 machines 13.5 lakh");
    expect(ambiguous.unitPrice).toBeNull();
    expect(ambiguous.needsOwnerInput).toContain("13.5 lakh");
  });
});

describe("extractReply without AI", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1"; // aiEnabled() → false even if a key is exported in the shell
  });

  it("falls back to the deterministic parser and strips the quoted RFQ", async () => {
    const body = `${DEMO_SUPPLIER_B_REPLY}\n\nOn Sat, 11 Oct 2026 at 10:02, Faisla wrote:\n> Hamza Garments is planning to buy 4 × JUKI AMS-221F\n> unit price (PKR) and total 99,99,999`;
    const x = await extractReply({ subject: "Re: RFQ for Madina Sewing Solutions", body });
    expect(x.source).toBe("parser");
    expect(x.unitPrice).toBe(13_40_000);
  });
});

describe("stripQuoted / buildReplyOffer", () => {
  it("keeps only the new text", () => {
    expect(stripQuoted("Price 13 lakh\n> old text\nOn Mon, X wrote:\nmore")).toBe("Price 13 lakh");
  });

  it("builds an email offer with a stable id and code-computed total", () => {
    const x = parseReplyText(DEMO_SUPPLIER_B_REPLY);
    const ctx = {
      key: "msg-1",
      supplierName: "Madina Sewing Solutions",
      supplierEmail: "b@test.com",
      item: "Pattern sewer",
      model: "JUKI AMS-221F",
      defaultQty: 4,
      receivedAt: "2026-10-11T06:25:00.000Z",
    };
    const offer = buildReplyOffer(x, ctx);
    expect(offer).toMatchObject({ id: `offer-email-${hashString("msg-1")}`, source: "email", qty: 4, unitPrice: 13_40_000, total: 53_60_000, deliveryDays: 10, warrantyMonths: 12 });
    expect(buildReplyOffer(parseReplyText("kal bataun ga"), ctx)).toBeNull();
  });
});
