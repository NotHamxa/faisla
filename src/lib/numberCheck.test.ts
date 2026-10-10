import { describe, expect, it } from "vitest";
import { demoDecision } from "./__fixtures__/demoDecision";
import { demoCompany, demoFinancing, demoOfferA, demoOfferB } from "./demoData";
import { decide } from "./finance";
import { allowedNumbers, memoFacts } from "./memoFacts";
import { memoTemplate } from "./memoTemplate";
import { checkMemoNumbers, extractNumbers, normalizeNumber } from "./numberCheck";
import type { ReputationResult } from "./types";

const reputations: Record<string, ReputationResult> = {
  "Al-Noor Industrial Machines": {
    supplierName: "Al-Noor Industrial Machines",
    model: "JUKI AMS-221F",
    flag: "mixed",
    averageRating: 3.4,
    reviews: [],
    reasons: ["2 buyers report slow warranty service"],
    cached: true,
  },
};

const context = { offers: [demoOfferA, demoOfferB], financing: demoFinancing };
const facts = memoFacts(demoDecision, reputations, context);
const allowed = allowedNumbers(facts);

describe("normalizeNumber", () => {
  it("strips grouping commas and trailing decimal zeros", () => {
    expect(normalizeNumber("49,87,935")).toBe("4987935");
    expect(normalizeNumber("4,987,935")).toBe("4987935");
    expect(normalizeNumber("2.50")).toBe("2.5");
    expect(normalizeNumber("10.0")).toBe("10");
  });
});

describe("extractNumbers", () => {
  it("reads Rs amounts, percentages and lakh figures", () => {
    const tokens = extractNumbers("Pay Rs 49,87,935 at 8.5%, saving Rs 5.8 lakh over 36 months.");
    expect(tokens.map((t) => t.normalized)).toEqual(["4987935", "8.5", "5.8", "36"]);
    expect(tokens[0].hasRs).toBe(true);
    expect(tokens[1].isPct).toBe(true);
  });

  it("ignores list markers, years, dates, model codes and the quoted 0% claim", () => {
    const text = [
      "1. Request the term sheet by 11 Oct 2026.",
      "## 2) Next steps for 2026",
      'The "0%" plan and the "0% markup" claim.',
      "Model JUKI AMS-221F.",
    ].join("\n");
    expect(extractNumbers(text)).toEqual([]);
  });

  it("does not ignore an unquoted 0%", () => {
    expect(extractNumbers("This plan is 0% interest.").map((t) => t.normalized)).toEqual(["0"]);
  });
});

describe("memoFacts", () => {
  it("lists the headline facts with their display strings", () => {
    const byKey = new Map(facts.map((f) => [f.key, f]));
    expect(byKey.get("row.offer-b:ltff.pvBeforeTax")).toMatchObject({ value: "Rs 49,87,935", alt: ["49,87,935", "49.9 lakh"] });
    expect(byKey.get("savings.beforeTax")).toMatchObject({ value: "Rs 5,79,103", alt: ["5,79,103", "5.8 lakh"] });
    expect(byKey.get("row.offer-a:installments.hiddenRate")?.value).toBe("16.9%");
    expect(byKey.get("row.offer-b:ltff.rate")?.value).toBe("8.5%");
    expect(byKey.get("row.offer-b:ltff.runway")?.value).toBe("2.59 months");
    expect(byKey.get("row.offer-b:ltff.principal")?.value).toBe("Rs 48,24,000");
    expect(byKey.get("row.offer-b:ltff.monthly")?.value).toBe("Rs 1,52,282");
    expect(byKey.get("runway.today")?.value).toBe("2.86 months");
    expect(byKey.get("breakEven")?.value).toBe("8.84%");
    expect(byKey.get("offer.offer-b.qty")?.value).toBe("4");
  });
});

describe("checkMemoNumbers", () => {
  const goodMemo = [
    "# Decision memo: Hamza Garments",
    "## Recommendation",
    "Buy 4 machines from Madina Sewing Solutions with the SBP LTFF loan at 8.5%: Rs 5,36,000 now and 36 × Rs 1,52,282.",
    "In today's money this costs **Rs 49,87,935** before tax and Rs 40,13,687 after tax.",
    "## Why",
    '- Saves Rs 5,79,103 against the "0%" installment plan, Rs 4,73,603 after tax.',
    "- That plan hides a 16.9% yearly rate.",
    "- Cash still covers 2.59 months of fixed costs (2.86 months today).",
    "",
    "| Option | Before tax | Runway |",
    "| --- | --- | --- |",
    "| B, LTFF 8.5% | Rs 49,87,935 | 2.59 months |",
    "| B, cash | Rs 53,60,000 | 1.33 months |",
    "",
    "1. Request an LTFF term sheet before 11 Oct 2026.",
    "2. Keep runway at or above 2 months.",
  ].join("\n");

  it("passes a memo that uses only allowed numbers", () => {
    expect(checkMemoNumbers(goodMemo, allowed)).toEqual({ passed: true, unknownNumbers: [] });
  });

  it("fails on an invented rupee amount", () => {
    const result = checkMemoNumbers(goodMemo + "\nYou also save Rs 6,10,000 on insurance.", allowed);
    expect(result.passed).toBe(false);
    expect(result.unknownNumbers).toEqual(["Rs 6,10,000"]);
  });

  it("fails on an invented or re-rounded percentage", () => {
    const result = checkMemoNumbers(goodMemo + "\nThe real rate is 17.4% and the loan 8.50% vs 8.6%.", allowed);
    expect(result.passed).toBe(false);
    expect(result.unknownNumbers).toEqual(["17.4%", "8.6%"]);
  });

  it("fails when the model rounds a figure differently", () => {
    expect(checkMemoNumbers("Runway 2.6 months; saving Rs 5.79 lakh.", allowed).unknownNumbers).toEqual([
      "2.6",
      "Rs 5.79",
    ]);
  });

  it("passes lakh and crore wording", () => {
    const memo =
      "Saves Rs 5.8 lakh (4.7 lakh after tax). True cost 49.9 lakh vs 55.7 lakh. Cash Rs 1 crore, costs 35 lakh a month.";
    expect(checkMemoNumbers(memo, allowed)).toEqual({ passed: true, unknownNumbers: [] });
  });

  it("passes the fallback template memo", () => {
    const memo = memoTemplate(demoDecision, reputations, context);
    expect(checkMemoNumbers(memo, allowed)).toEqual({ passed: true, unknownNumbers: [] });
    expect(memo).toContain("## Recommendation");
    expect(memo).toContain("| **B, LTFF 8.5%** |");
    expect(memo).toContain("Mixed reviews for Al-Noor Industrial Machines");
  });

  it("passes the template even without offers, financing or reputations", () => {
    const bare = memoFacts(demoDecision);
    expect(checkMemoNumbers(memoTemplate(demoDecision), allowedNumbers(bare)).passed).toBe(true);
  });
});

describe("with the real finance engine", () => {
  const offers = [demoOfferA, demoOfferB];
  const real = decide({ company: demoCompany, offers, financing: demoFinancing });

  it("builds the same headline facts as the spec fixture", () => {
    const byKey = new Map(memoFacts(real, undefined, { offers }).map((f) => [f.key, f.value]));
    expect(byKey.get("row.offer-b:ltff.pvBeforeTax")).toBe("Rs 49,87,935");
    expect(byKey.get("row.offer-b:ltff.principal")).toBe("Rs 48,24,000");
    expect(byKey.get("row.offer-b:ltff.rate")).toBe("8.5%");
    expect(byKey.get("savings.afterTax")).toBe("Rs 4,73,603");
  });

  it("template memo passes the number check, also under a KIBOR stress shift", () => {
    for (const kiborShift of [0, 0.02]) {
      const decision = decide({ company: demoCompany, offers, financing: demoFinancing, kiborShift });
      const memo = memoTemplate(decision, reputations, { offers, financing: demoFinancing });
      const check = checkMemoNumbers(memo, allowedNumbers(memoFacts(decision, reputations, { offers, financing: demoFinancing })));
      expect(check).toEqual({ passed: true, unknownNumbers: [] });
    }
  });
});
