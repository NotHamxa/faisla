import { describe, expect, it } from "vitest";
import searchCache from "@/data/cache/search.json";
import { DEMO_ITEM, DEMO_MODEL, demoCompany, demoFinancing } from "./demoData";
import { decide } from "./finance";
import { memoTemplate } from "./memoTemplate";
import { parseAmounts } from "./replyParser";
import type { SearchCacheEntry } from "./search";
import {
  budgetFit,
  candidatesFromCache,
  cityInNeed,
  demoNeedRequest,
  describeSourcingDropped,
  isDemoNeed,
  type ListingCandidate,
  needToQuotation,
  optionToOffer,
  optionTotal,
  parseNeedQty,
  rankListings,
  selectedOptions,
} from "./sourcing";

const jukiEntry = (searchCache as unknown as { entries: Record<string, SearchCacheEntry> }).entries[
  "juki ams 221f price pakistan"
];

function listing(over: Partial<ListingCandidate>): ListingCandidate {
  return {
    seller: "Seller",
    item: "Embroidery machine",
    model: "Tajima TMEZ",
    title: "Listing",
    price: 10_00_000,
    condition: "new",
    match: "exact",
    url: "https://example.com",
    contactEmail: null,
    contactPhone: null,
    simulated: false,
    ...over,
  };
}

describe("rankListings", () => {
  it("demo JUKI cache: 5 new exact-model options, median Rs 13,60,000, cheapest first", () => {
    const ranked = rankListings(candidatesFromCache(jukiEntry, DEMO_ITEM));
    expect(ranked.options.map((o) => o.unitPrice)).toEqual([13_20_000, 13_50_000, 13_60_000, 13_75_000, 14_20_000]);
    expect(ranked.medianUnitPrice).toBe(13_60_000);
    expect(ranked.minUnitPrice).toBe(13_20_000);
    expect(ranked.enoughData).toBe(true);
    expect(ranked.options.every((o) => o.simulated && o.model === DEMO_MODEL)).toBe(true);
    expect(ranked.options.map((o) => o.id)).toEqual(["opt-1", "opt-2", "opt-3", "opt-4", "opt-5"]);
    // used Gujranwala, AMS-210EN (other model), Indian ₹ listing and spec sheet (no PKR price)
    expect(ranked.dropped).toEqual({ noPrice: 2, used: 1, otherModel: 1, duplicate: 0, outlier: 0 });
    expect(describeSourcingDropped(ranked.dropped)).toBe("4 listings left out: 2 without a PKR price, 1 used, 1 not matching.");
  });

  it("drops used, unpriced and non-matching listings; keeps close matches and unknown condition", () => {
    const ranked = rankListings([
      listing({ seller: "A", price: null }),
      listing({ seller: "B", condition: "used" }),
      listing({ seller: "C", match: "other" }),
      listing({ seller: "D", match: "close", model: "Brother PR" }),
      listing({ seller: "E", condition: "unknown", price: 9_00_000 }),
    ]);
    expect(ranked.options.map((o) => o.seller)).toEqual(["E", "D"]);
    expect(ranked.options[1].exactModel).toBe(false);
    expect(ranked.options[0].condition).toBe("unknown");
    // fewer than 3 prices: no median ("not enough market data")
    expect(ranked.enoughData).toBe(false);
    expect(ranked.medianUnitPrice).toBeNull();
    expect(ranked.minUnitPrice).toBe(9_00_000);
  });

  it("dedupes the same seller + model, keeping the cheaper listing", () => {
    const ranked = rankListings([
      listing({ seller: "Hall Road Traders", price: 11_00_000, url: "a" }),
      listing({ seller: "hall road traders", price: 10_50_000, url: "b" }),
      listing({ seller: "Other", price: 10_00_000 }),
    ]);
    expect(ranked.options).toHaveLength(2);
    expect(ranked.options.find((o) => o.seller.toLowerCase() === "hall road traders")?.unitPrice).toBe(10_50_000);
    expect(ranked.dropped.duplicate).toBe(1);
  });

  it("drops outliers outside 0.5×–2× of the median", () => {
    const ranked = rankListings([
      listing({ seller: "A", price: 10_00_000 }),
      listing({ seller: "B", price: 11_00_000 }),
      listing({ seller: "C", price: 12_00_000 }),
      listing({ seller: "D", price: 2_00_000 }), // spare part / deposit
      listing({ seller: "E", price: 50_00_000 }), // whole lot
    ]);
    expect(ranked.options.map((o) => o.seller)).toEqual(["A", "B", "C"]);
    expect(ranked.dropped.outlier).toBe(2);
    expect(ranked.medianUnitPrice).toBe(11_00_000);
  });
});

describe("options → offers and quotation", () => {
  const { options } = rankListings(candidatesFromCache(jukiEntry, DEMO_ITEM));
  const need = demoNeedRequest(
    "4 computer-controlled pattern sewing machines for my garment factory in Faisalabad, budget around 60 lakh",
    { qty: null, city: "Faisalabad", budget: 60_00_000 },
    jukiEntry.query,
  );

  it("builds the demo request in code", () => {
    expect(need.qty).toBe(4);
    expect(need.item).toBe(DEMO_ITEM);
    expect(need.modelCandidates).toEqual([DEMO_MODEL]);
    expect(need.budgetPkr).toBe(60_00_000);
  });

  it("offer total is qty × listed unit price, computed in code", () => {
    const offer = optionToOffer(options[0], 4, 0);
    expect(offer.id).toBe("offer-web-1");
    expect(offer.source).toBe("web");
    expect(offer.unitPrice).toBe(13_20_000);
    expect(offer.total).toBe(52_80_000);
    expect(offer.sourceLink).toBe(options[0].url);
    expect(offer.installmentMonths).toBeNull();
    expect(optionTotal(options[4], 4)).toBe(56_80_000);
  });

  it("budget fit uses the code total", () => {
    expect(budgetFit(52_80_000, 60_00_000)).toEqual({ within: true, over: -7_20_000 });
    expect(budgetFit(62_00_000, 60_00_000)).toEqual({ within: false, over: 2_00_000 });
    expect(budgetFit(62_00_000, null)).toBeNull();
  });

  it("needToQuotation gives downstream steps item, model, qty and the listed unit price", () => {
    const q = needToQuotation(options[0], need);
    expect(q.supplierName).toBe("Lahore Sewing Hub (Lahore)");
    expect(q.items).toEqual([{ description: DEMO_ITEM, model: DEMO_MODEL, qty: 4, unitPrice: 13_20_000, lineTotal: null }]);
    expect(q.printedTotal).toBeNull();
    expect(q.firstInstallmentOnDelivery).toBeNull();
    expect(q.installmentMonths).toBeNull();
  });

  it("selection keeps price order and caps at 3", () => {
    expect(selectedOptions(options, ["opt-4", "opt-1", "opt-2", "opt-3"]).map((o) => o.id)).toEqual(["opt-1", "opt-2", "opt-3"]);
  });

  it("decide() works with web offers only: no baseline, no invented savings, memo still written", () => {
    const offers = selectedOptions(options, ["opt-1", "opt-3"]).map((o, i) => optionToOffer(o, need.qty, i));
    const result = decide({ company: demoCompany, offers, financing: demoFinancing });
    expect(result.baselineId).toBeNull();
    expect(result.savingsVsBaseline).toBeNull();
    expect(result.rows.length).toBeGreaterThan(0);
    const memo = memoTemplate(result, {}, { offers, financing: demoFinancing });
    expect(memo).toContain("## Recommendation");
    expect(memo).not.toContain("original quotation");
  });
});

describe("need text helpers", () => {
  it("recognises the demo need", () => {
    expect(isDemoNeed("4 computer-controlled pattern sewing machines")).toBe(true);
    expect(isDemoNeed("JUKI AMS-221F x4")).toBe(true);
    expect(isDemoNeed("2 industrial embroidery machines for Lahore")).toBe(false);
  });

  it("finds the city written in the need", () => {
    expect(cityInNeed("2 industrial embroidery machines for Lahore, budget 20 lakh")).toBe("Lahore");
    expect(cityInNeed("garment factory in Faisalabad; deliver to Lahore")).toBe("Faisalabad");
    expect(cityInNeed("embroidery machine, budget 20 lakh")).toBeNull();
  });

  it("reads quantity only in front of a unit word", () => {
    expect(parseNeedQty("4 computer-controlled pattern sewing machines, budget around 60 lakh")).toBe(4);
    expect(parseNeedQty("2 industrial embroidery machines for Lahore, budget 20 lakh")).toBe(2);
    expect(parseNeedQty("embroidery machine, budget 20 lakh")).toBeNull();
  });

  it("the price check finds the amounts written in the demo listings", () => {
    const written = (i: number) => parseAmounts(`${jukiEntry.results[i].title}\n${jukiEntry.results[i].content}`).map((a) => a.value);
    expect(written(0)).toContain(13_50_000);
    expect(written(1)).toContain(13_20_000);
    expect(written(2)).toContain(13_75_000);
    expect(parseAmounts("budget around 60 lakh").map((a) => a.value)).toEqual([60_00_000]);
  });
});
