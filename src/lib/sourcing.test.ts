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
  checkRequirements,
  cityInNeed,
  cleanRequirements,
  emptyNeedNote,
  isUsedListing,
  listingUrlProblem,
  screenResults,
  storeNameFromUrl,
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
import type { SpecRequirement } from "./types";

const f5Entry = (searchCache as unknown as { entries: Record<string, SearchCacheEntry> }).entries[
  "jack f5 price pakistan"
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
  it("demo Jack F5 cache (real listings): 3 new exact-model options, median Rs 70,000, cheapest first", () => {
    const ranked = rankListings(candidatesFromCache(f5Entry, DEMO_ITEM));
    expect(ranked.options.map((o) => o.unitPrice)).toEqual([63_000, 70_000, 79_000]);
    expect(ranked.medianUnitPrice).toBe(70_000);
    expect(ranked.minUnitPrice).toBe(63_000);
    expect(ranked.enoughData).toBe(true);
    expect(ranked.options.every((o) => !o.simulated && o.model === DEMO_MODEL && o.url.startsWith("https://"))).toBe(true);
    expect(ranked.options.map((o) => o.id)).toEqual(["opt-1", "opt-2", "opt-3"]);
    // used Jack F6, Jack F4 (other model), Indian ₹ listing and spec sheet (no PKR price)
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
  const { options } = rankListings(candidatesFromCache(f5Entry, DEMO_ITEM));
  const need = demoNeedRequest(
    "80 direct-drive lockstitch sewing machines for my garment factory in Faisalabad, budget around 60 lakh",
    { qty: null, city: "Faisalabad", budget: 60_00_000 },
    f5Entry.query,
  );

  it("builds the demo request in code", () => {
    expect(need.qty).toBe(80);
    expect(need.item).toBe(DEMO_ITEM);
    expect(need.modelCandidates).toEqual([DEMO_MODEL]);
    expect(need.budgetPkr).toBe(60_00_000);
  });

  it("offer total is qty × listed unit price, computed in code", () => {
    const offer = optionToOffer(options[0], 80, 0);
    expect(offer.id).toBe("offer-web-1");
    expect(offer.source).toBe("web");
    expect(offer.unitPrice).toBe(63_000);
    expect(offer.total).toBe(50_40_000);
    expect(offer.sourceLink).toBe(options[0].url);
    expect(offer.installmentMonths).toBeNull();
    expect(optionTotal(options[2], 80)).toBe(63_20_000);
  });

  it("budget fit uses the code total", () => {
    expect(budgetFit(50_40_000, 60_00_000)).toEqual({ within: true, over: -9_60_000 });
    expect(budgetFit(62_00_000, 60_00_000)).toEqual({ within: false, over: 2_00_000 });
    expect(budgetFit(62_00_000, null)).toBeNull();
  });

  it("needToQuotation gives downstream steps item, model, qty and the listed unit price", () => {
    const q = needToQuotation(options[0], need);
    expect(q.supplierName).toBe("Market Guide Vlogs (Lahore machinery market)");
    expect(q.items).toEqual([{ description: DEMO_ITEM, model: DEMO_MODEL, qty: 80, unitPrice: 63_000, lineTotal: null }]);
    expect(q.printedTotal).toBeNull();
    expect(q.firstInstallmentOnDelivery).toBeNull();
    expect(q.installmentMonths).toBeNull();
  });

  it("selection keeps price order and caps at 3", () => {
    expect(selectedOptions(options, ["opt-3", "opt-1"]).map((o) => o.id)).toEqual(["opt-1", "opt-3"]);
    const four = [...options, { ...options[2], id: "opt-4" }];
    expect(selectedOptions(four, ["opt-4", "opt-1", "opt-2", "opt-3"]).map((o) => o.id)).toEqual(["opt-1", "opt-2", "opt-3"]);
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
    expect(isDemoNeed("80 direct-drive lockstitch sewing machines")).toBe(true);
    expect(isDemoNeed("Jack F5 x80")).toBe(true);
    expect(isDemoNeed("10 single needle lockstitch sewing machines with servo motors")).toBe(false);
    expect(isDemoNeed("2 industrial embroidery machines for Lahore")).toBe(false);
  });

  it("finds the city written in the need", () => {
    expect(cityInNeed("2 industrial embroidery machines for Lahore, budget 20 lakh")).toBe("Lahore");
    expect(cityInNeed("garment factory in Faisalabad; deliver to Lahore")).toBe("Faisalabad");
    expect(cityInNeed("embroidery machine, budget 20 lakh")).toBeNull();
  });

  it("reads quantity only in front of a unit word", () => {
    expect(parseNeedQty("80 direct-drive lockstitch sewing machines, budget around 60 lakh")).toBe(80);
    expect(parseNeedQty("2 industrial embroidery machines for Lahore, budget 20 lakh")).toBe(2);
    expect(parseNeedQty("embroidery machine, budget 20 lakh")).toBeNull();
  });

  it("the price check finds the amounts written in the demo listings", () => {
    const written = (i: number) => parseAmounts(`${f5Entry.results[i].title}\n${f5Entry.results[i].content}`).map((a) => a.value);
    expect(written(0)).toContain(79_000);
    expect(written(1)).toContain(70_000);
    expect(written(2)).toContain(63_000);
    expect(parseAmounts("budget around 60 lakh").map((a) => a.value)).toEqual([60_00_000]);
  });
});

/* ---------- Live search rules ---------- */

const PC_REQS: SpecRequirement[] = [
  { label: "Core i9", mustHave: true, anyOf: ["i9", "core i9", "ultra 9", "core ultra 9"], noneOf: ["i5", "i7"] },
  { label: "RTX 4050", mustHave: true, anyOf: ["rtx 4050", "4050"], noneOf: [] },
  {
    label: "Current-gen Intel",
    mustHave: true,
    anyOf: ["13th gen", "14th gen", "13900", "13980", "14900", "ultra 9 285", "285k", "285hx"],
    noneOf: [],
  },
];
const LONG = " Free delivery across Pakistan. 1 year official warranty. ".repeat(10);

describe("checkRequirements (code checks specs, never the AI)", () => {
  it("i9 14th gen + RTX 4050 passes, spacing and case ignored", () => {
    expect(checkRequirements("Gaming PC Intel Core i9-14900K | RTX4050 6GB", LONG, PC_REQS).status).toBe("matched");
    expect(checkRequirements("HP Omen 16 CORE I9 13900HX Rtx 4050", LONG, PC_REQS).status).toBe("matched");
  });

  it("i5 4th gen fails even when the AI would call it a match", () => {
    const c = checkRequirements("Gaming PC Core i5 4th Gen with RTX 4050 - Rs 85,000", LONG, PC_REQS);
    expect(c.status).toBe("mismatch");
    expect(c.conflicts).toContain("i5");
  });

  it("Core Ultra 9 285K + RTX 4050 passes", () => {
    expect(checkRequirements("Core Ultra 9 285K + RTX 4050 Gaming Build", LONG, PC_REQS).status).toBe("matched");
  });

  it("a different graphics card or tier is a conflict (sibling numbers), even without noneOf", () => {
    expect(checkRequirements("Core i9 14900K RTX 4060 PC", LONG, PC_REQS).status).toBe("mismatch");
    const noNone = PC_REQS.map((r) => ({ ...r, noneOf: [] }));
    expect(checkRequirements("Core i7 14700K RTX 4050 PC", LONG, noNone).status).toBe("mismatch");
    // "Ci7" is how many Pakistani shops write Core i7; the URL slug counts as part of the title
    expect(checkRequirements("ASUS TUF GAMING F15-FX507VU Ci7-13620H", "Rs 3,19,999", noNone).status).toBe("mismatch");
    expect(
      checkRequirements("Lenovo Legion Pro 5", "i9 13900HX, RTX 4050 also available", PC_REQS, "https://x.pk/p/legion-pro-5-i9-13900hx-rtx-4070-8gb")
        .status,
    ).toBe("mismatch");
  });

  it("too little text to tell: unverified; a long page that never mentions a spec: mismatch", () => {
    const short = checkRequirements("Gaming PC RTX 4050 Core i9", "Rs 4,50,000", PC_REQS);
    expect(short.status).toBe("unverified");
    expect(short.missing).toEqual(["Current-gen Intel"]);
    expect(checkRequirements("Gaming PC RTX 4050 Core i9", LONG, PC_REQS).status).toBe("mismatch");
  });

  it("whole words only; prices never count as model numbers", () => {
    const reqs: SpecRequirement[] = [{ label: "Ultra 9 285", mustHave: true, anyOf: ["285"], noneOf: [] }];
    expect(checkRequirements("Gaming PC Rs 285,000", "", reqs).status).toBe("unverified");
    expect(checkRequirements("i90 machine", "", [PC_REQS[0]]).status).not.toBe("matched");
  });

  it("works for other categories: 5 kW inverter, 100 kVA generator", () => {
    const kw: SpecRequirement[] = [{ label: "5 kW", mustHave: true, anyOf: ["5kw", "5 kw", "5000w"], noneOf: [] }];
    expect(checkRequirements("Inverex Nitrox 5KW Hybrid Inverter", LONG, kw).status).toBe("matched");
    expect(checkRequirements("Inverex 3kW Hybrid Inverter", LONG, kw).status).toBe("mismatch");
    expect(checkRequirements("5.5 kW hybrid inverter", LONG, kw).status).toBe("mismatch");
    const kva: SpecRequirement[] = [{ label: "100 kVA", mustHave: true, anyOf: ["100kva", "100 kva"], noneOf: [] }];
    expect(checkRequirements("Perkins 100 KVA Diesel Generator", LONG, kva).status).toBe("matched");
  });

  it("no must-have specs: nothing to check", () => {
    expect(checkRequirements("Anything", "", []).status).toBe("matched");
    expect(checkRequirements("Anything", "", [{ label: "x", mustHave: false, anyOf: ["zz"] }]).status).toBe("matched");
  });

  it("cleanRequirements lowercases, dedupes and drops empty specs", () => {
    expect(
      cleanRequirements([
        { label: " Core i9 ", mustHave: true, anyOf: ["I9", "i9", " Core-i9 ", "x"], noneOf: ["I5"] },
        { label: "Empty", mustHave: true, anyOf: [] },
      ]),
    ).toEqual([{ label: "Core i9", mustHave: true, anyOf: ["i9", "core i9"], noneOf: ["i5"] }]);
  });
});

describe("listing pages, used filter, stores", () => {
  it("search, category and collection pages are not listings", () => {
    for (const url of [
      "https://www.olx.com.pk/lahore_g4060673/q-gaming-pc",
      "https://www.olx.com.pk/items/q-rtx-4050",
      "https://www.daraz.pk/catalog/?q=gaming+pc",
      "https://shop.pk/search?q=i9",
      "https://shop.pk/?s=inverter",
      "https://shop.pk/product-category/inverters/",
      "https://shop.pk/category/gaming-pcs",
      "https://store.pk/collections/gaming-laptops",
      "https://store.pk/",
      "https://www.youtube.com/watch?v=abc",
    ]) {
      expect(listingUrlProblem(url), url).not.toBeNull();
    }
    for (const url of [
      "https://www.czone.com.pk/laptops-hp-omen-16-core-i9-13900hx-rtx-4050-pakistan-p.aspx",
      "https://store.pk/collections/gaming-laptops/products/omen-16",
      "https://www.daraz.pk/products/inverex-5kw-i123456.html",
      "https://www.olx.com.pk/item/jack-f5-sewing-machine-iid-1119872069",
    ]) {
      expect(listingUrlProblem(url), url).toBeNull();
    }
  });

  it("used / refurbished / open-box are dropped, unused is not", () => {
    expect(isUsedListing("Used Gaming PC i9", "")).toBe(true);
    expect(isUsedListing("Gaming PC i9", "Condition: Used")).toBe(true);
    expect(isUsedListing("HP Omen (Open Box)", "")).toBe(true);
    expect(isUsedListing("Refurbished Dell", "")).toBe(true);
    expect(isUsedListing("JACK F5 Heavy Duty Machine (Unused)", "")).toBe(false);
    expect(isUsedListing("Gaming PC", "Best PC used for gaming and editing")).toBe(false);
  });

  it("store name from the website", () => {
    expect(storeNameFromUrl("https://www.czone.com.pk/x")).toBe("Czone");
    expect(storeNameFromUrl("https://shop.galaxytech.pk/x")).toBe("Galaxytech");
  });

  it("screenResults keeps product pages with a price that do not contradict the specs", () => {
    const res = (title: string, url: string, content = "Price Rs 4,50,000. In stock.") => ({ title, url, content });
    const { kept, dropped } = screenResults(
      [
        res("Core i9 14900K RTX 4050 PC", "https://a.pk/p/pc-1"),
        res("Core i5 4th gen PC", "https://b.pk/p/pc-2"),
        res("Gaming PCs", "https://c.pk/search?q=pc"),
        res("Used i9 RTX 4050", "https://d.pk/p/pc-3"),
        res("Core i9 RTX 4050 PC", "https://www.olx.com.pk/item/pc-iid-1"),
        res("Core i9 RTX 4050 PC", "https://e.pk/p/pc-4", "Call for price"),
        res("Core i9 RTX 4050 PC", "https://f.pk/p/pc-5"),
      ],
      { requirements: PC_REQS, condition: "new" },
    );
    expect(kept.map((k) => [k.result.url, k.specStatus])).toEqual([
      ["https://a.pk/p/pc-1", "matched"],
      ["https://f.pk/p/pc-5", "unverified"],
    ]);
    expect(dropped).toEqual({ notListing: 1, usedSite: 1, used: 1, noPrice: 1, specMismatch: 1 });
    // used asked: the marketplace and the used listing stay
    const usedAsked = screenResults([res("Used i9 RTX 4050 14th gen", "https://www.olx.com.pk/item/pc-iid-1")], {
      requirements: PC_REQS,
      condition: "used",
    });
    expect(usedAsked.kept).toHaveLength(1);
  });

  it("rankListings: max 2 per website, spec-matched first by price, then unverified", () => {
    const ranked = rankListings(
      [
        listing({ seller: "Czone", title: "A", model: null, url: "https://czone.com.pk/a", price: 5_00_000 }),
        listing({ seller: "Czone", title: "B", model: null, url: "https://czone.com.pk/b", price: 4_80_000 }),
        listing({ seller: "Czone", title: "C", model: null, url: "https://www.czone.com.pk/c", price: 4_90_000 }),
        listing({ seller: "Paklap", title: "D", model: null, url: "https://paklap.pk/d", price: 4_00_000, specStatus: "unverified" }),
        listing({ seller: "Galaxy", title: "E", model: null, url: "https://galaxy.pk/e", price: 5_20_000, specStatus: "matched" }),
      ],
      { maxPerDomain: 2 },
    );
    expect(ranked.options.map((o) => o.title)).toEqual(["B", "C", "E", "D"]);
    expect(ranked.options[3].specStatus).toBe("unverified");
    expect(ranked.capped).toBe(1);
  });

  it("honest empty-state line", () => {
    expect(emptyNeedNote({ item: "Gaming PC", requirements: PC_REQS.slice(0, 2), condition: "new" })).toBe(
      "No new listings match Core i9 + RTX 4050. Try other words, paste a link you found, or upload a quotation.",
    );
  });
});

describe("pages to open and excerpts", () => {
  it("only marked prices count; model numbers and cart widgets don't", async () => {
    const { hasMarkedPrice, productPageScore, pageExcerpt } = await import("./sourcing");
    expect(hasMarkedPrice("Core i9 13900H RTX 4050")).toBe(false);
    expect(hasMarkedPrice("Cart PKR 0.00 0 items")).toBe(false);
    expect(hasMarkedPrice("Price: Rs. 3,34,999")).toBe(true);
    expect(hasMarkedPrice("Only 26.5 lakh")).toBe(true);
    expect(productPageScore("https://solartrade.pk/product/inverex-5kw-nitrox-hybrid-inverter")).toBe(2);
    expect(productPageScore("https://oespak.com/5kw-solar-system-price-in-pakistan-2026")).toBe(0);
    expect(productPageScore("https://shop.pk/search?q=x")).toBe(0);
    const long = "menu ".repeat(600) + "Nitrox 5kW Price Rs 2,35,000 Add to cart " + "footer ".repeat(300);
    const ex = pageExcerpt(long);
    expect(ex.length).toBeLessThanOrEqual(3500);
    expect(ex).toContain("Rs 2,35,000");
  });
});
