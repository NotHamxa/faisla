// POST { need, qty?, city?, budget? } → SourcingResponse (or NeedsOwnerInput).
// "Describe what you need": AI structures the need (item, specs as checkable keywords, queries) →
// search new-item retail in Pakistan (cache first) → code screens every result (single product page,
// new, written PKR amount, specs not contradicted) → AI reads the survivors → code checks each price is
// written in the listing, re-checks the specs, dedupes, caps 2 per store, ranks and takes the median.
// The rehearsed demo need (direct-drive lockstitch / Jack F5) is answered from the cached real
// listings (src/data/cache/search.json) without any network call.
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import { aiEnabled, aiJson } from "@/lib/ai";
import { DEMO_MODEL } from "@/lib/demoData";
import { parseAmounts } from "@/lib/replyParser";
import { lookupCacheByModel, searchEnabled, searchWithCache, type SearchResult, tavilyExtractMany } from "@/lib/search";
import {
  candidatesFromCache,
  cityInNeed,
  cleanRequirements,
  cleanStoreName,
  demoNeedRequest,
  describeScreenDropped,
  describeSourcingDropped,
  emptyNeedNote,
  FOREIGN_MARKETS,
  isDemoNeed,
  isUsedListing,
  type ListingCandidate,
  NOT_SHOPS,
  parseNeedQty,
  pageExcerpt,
  pickForExtract,
  rankListings,
  screenResults,
  type ScreenedResult,
  type SourcingResponse,
  USED_MARKETPLACES,
} from "@/lib/sourcing";
import type { NeedRequest, NeedsOwnerInput } from "@/lib/types";

export const maxDuration = 60;

const MAX_PER_STORE = 2;
const MAX_PAGES_TO_OPEN = 10; // Tavily Extract: 1 credit per 5 pages

const inputSchema = z.object({
  need: z.string().trim().min(3).max(600),
  qty: z.number().int().min(1).max(1000).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  budget: z.number().int().min(1).max(100_000_000_000).nullable().optional(),
});

// AI schemas: strict structured outputs, so nullable (never optional).
const requestSchema = z.object({
  item: z.string().describe("Short generic name of the product, e.g. 'Gaming PC', 'Hybrid solar inverter', 'Diesel generator'"),
  modelCandidates: z.array(z.string()).describe("Specific brand/model names the owner named or that obviously fit; empty if none"),
  qty: z.number().int().nullable().describe("How many units the owner wants, or null if not said"),
  budgetPkr: z.number().int().nullable().describe("Total budget in PKR as written (60 lakh = 6000000), or null if not said"),
  city: z.string().nullable().describe("City named in the need, or null"),
  condition: z.enum(["new", "used"]).describe("'used' only if the owner asked for used / second-hand; otherwise 'new'"),
  requirements: z
    .array(
      z.object({
        label: z.string().describe("Short plain label, e.g. 'Core i9', 'RTX 4050', '5 kW', 'Current-gen Intel'"),
        mustHave: z.boolean().describe("true for every spec the owner actually wrote"),
        anyOf: z.array(z.string()).describe("Lowercase keywords; a listing matches if its text contains ANY of them"),
        noneOf: z.array(z.string()).describe("Lowercase keywords that clearly mean a different spec; may be empty"),
      }),
    )
    .describe("Only specs the owner wrote (model, size, capacity, power, generation); not the product type itself"),
  searchQueries: z.array(z.string()).describe("Exactly 3 web search queries for NEW units sold by shops in Pakistan, with prices"),
});

const listingSchema = z.object({
  listings: z.array(
    z.object({
      index: z.number().int().describe("Index [n] of the search result"),
      store: z.string().describe("Shop / website brand name as written (e.g. 'Czone', 'Galaxy Tech'); the site name if none"),
      model: z.string().nullable().describe("Brand and model as written, or null"),
      pricePkr: z.number().int().nullable().describe("Price of ONE unit in PKR exactly as written, or null. Do not estimate."),
      condition: z.enum(["new", "used", "refurbished", "unknown"]),
      pageType: z.enum(["product", "list", "article", "other"]).describe("product = a page selling one product"),
      kind: z.enum(["same", "accessory", "different"]).describe("same = the kind of product the owner wants; accessory = part/add-on"),
      contactEmail: z.string().nullable(),
      contactPhone: z.string().nullable(),
    }),
  ),
});

const STRUCTURE_SYSTEM = `You turn a Pakistani business owner's purchase need into a structured request for a web search.
Copy numbers exactly as written; convert lakh/crore exactly (60 lakh = 6000000, 1.2 crore = 12000000). Never guess a budget or quantity that is not written.

requirements: ONE entry PER SEPARATE SPEC the owner wrote (processor tier, processor generation, graphics card, capacity, power rating, size, model). Code requires EVERY must-have entry and accepts ANY keyword inside one entry, so never put two different specs in one entry: "current-gen Core i9" is TWO entries (tier "Core i9" and generation "Current-gen Intel").
- anyOf = every common way a shop writes that spec, lowercase, whole words or full model numbers (no partial numbers, no prices). Include spaced and unspaced forms when shops use both.
- noneOf = clear conflicting values shops write instead (lower/other tiers, other sizes); empty if unsure.
- "current generation" / "latest" means what is current in October 2026; spell out concrete model numbers.
- Do not add the product type itself, brands the owner did not name, or anything not written.
Examples:
- "Core i9" → anyOf ["i9","core i9","ultra 9","core ultra 9"], noneOf ["i3","i5","i7","core i5","core i7","ultra 5","ultra 7","ryzen"]
- "Current-gen Intel" → anyOf ["13th gen","14th gen","13900","13950","13980","14900","ultra 9 285","285k","285hx","285h","275hx"], noneOf ["4th gen","8th gen","9th gen","10th gen","11th gen","12th gen","12900","11900","10900","9900"]
- "RTX 4050" → anyOf ["rtx 4050","4050"], noneOf ["rtx 3050","rtx 4060","gtx 1650"]
- "5 kW" inverter → anyOf ["5kw","5 kw","5000w","5000 w","5kva","5 kva"], noneOf ["3kw","4kw","6kw","8kw","10kw"]
- "100 kVA" generator → anyOf ["100kva","100 kva"], noneOf []

modelCandidates: up to 4 real products sold in Pakistan that have ALL the written specs. Think about which products actually exist: e.g. the RTX 4050 is a laptop graphics card, so "gaming PC with i9 + RTX 4050" means gaming laptops such as "ASUS TUF Gaming F15", "MSI Katana 15", "Dell G15", "HP Victus 16". Give 2-4 whenever the category has well-known brands sold in Pakistan (e.g. 5 kW hybrid inverters: "Inverex Nitrox 5kW", "Growatt SPF 5000 ES", "Fronus PV 5200"); empty only if you truly know none.

searchQueries: exactly 3 queries that land on single PRODUCT pages of Pakistani retail shops (not category pages). Use the product word and spec spelling shops use in product titles (e.g. 'laptop' rather than 'gaming PC' for an RTX 4050; 'i9 13900H' rather than 'current gen i9'):
1. '<key specs as in product titles> <product word> price in Pakistan' (e.g. 'i9 13900H RTX 4050 laptop price in Pakistan', '5kW hybrid solar inverter price in Pakistan')
2. 'buy <first model candidate> <key specs> online Pakistan Rs add to cart'
3. 'buy <second model candidate> <key specs> online Pakistan Rs add to cart'
("price in Pakistan" alone mostly finds price-guide articles; the shop-style wording finds product pages.)
Do not target OLX, Facebook or used/classified sites unless the owner asked for used.`;

function needsOwnerInput(reason: string) {
  return Response.json({ needsOwnerInput: true, reason } satisfies NeedsOwnerInput);
}

// Amounts the owner actually wrote ("budget around 60 lakh" → 6000000). The largest one is the budget.
function writtenBudget(need: string): number | null {
  const amounts = parseAmounts(need).map((a) => a.value);
  return amounts.length ? Math.max(...amounts) : null;
}

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe what you need in a few words." }, { status: 400 });
  const { need } = parsed.data;
  const input = {
    qty: parsed.data.qty ?? null,
    city: parsed.data.city?.trim() || null,
    budget: parsed.data.budget ?? null,
  };

  const needCity = cityInNeed(need);

  if (isDemoNeed(need) || !aiEnabled()) {
    const entry = isDemoNeed(need) ? lookupCacheByModel(DEMO_MODEL) : null;
    if (!entry) return needsOwnerInput("Search needs the AI key; upload a quotation instead.");
    const demoInput = { ...input, city: needCity ?? input.city, budget: input.budget ?? writtenBudget(need) };
    return Response.json(fromDemoCache(need, demoInput, entry));
  }

  const structureOpts = {
    tier: "read" as const, // the spec keywords decide what is dropped: worth the better reader (~$0.0005)
    maxTokens: 4000,
    system: STRUCTURE_SYSTEM,
    prompt: `Owner's need: ${need}${!needCity && input.city ? `\nOwner's city (from their profile): ${input.city}` : ""}`,
  };
  // One retry: a single slow or failed call shouldn't end the search.
  const structured = (await aiJson(requestSchema, structureOpts)) ?? (await aiJson(requestSchema, structureOpts));
  if (!structured) return needsOwnerInput("Faisla couldn't understand that need right now. Try again, or upload a quotation instead.");

  const amounts = parseAmounts(need).map((a) => a.value);
  // The AI's budget only counts if the owner actually wrote that amount.
  const aiBudget = structured.budgetPkr != null && amounts.some((v) => Math.abs(v - structured.budgetPkr!) <= 1) ? structured.budgetPkr : null;
  const aiQty = structured.qty != null && structured.qty > 0 && structured.qty <= 1000 ? structured.qty : null;
  const aiCity = structured.city?.trim() || null;
  // "used" only counts when the owner's own words say so.
  const condition = structured.condition === "used" && /\b(used|second[\s-]?hand|2nd[\s-]?hand|refurb\w*|old)\b/i.test(need) ? "used" : "new";
  const item = structured.item.trim() || need.slice(0, 80);
  const queries = [...new Set(structured.searchQueries.map((q) => q.trim()).filter(Boolean))].slice(0, 3);
  const req: NeedRequest = {
    need,
    item,
    modelCandidates: structured.modelCandidates.map((m) => m.trim()).filter(Boolean).slice(0, 5),
    qty: input.qty ?? aiQty ?? parseNeedQty(need) ?? 1,
    // A city written in the need beats the form's default (the company's city).
    city: needCity ?? (aiCity && need.toLowerCase().includes(aiCity.toLowerCase()) ? aiCity : null) ?? input.city,
    budgetPkr: input.budget ?? aiBudget,
    searchQueries: queries.length ? queries : [`${item} price in Pakistan`],
    requirements: cleanRequirements(structured.requirements),
    condition,
  };

  // Search: cache first per query, live (advanced depth, no used marketplaces) only on a miss.
  const excludeDomains = [...(condition === "used" ? [] : USED_MARKETPLACES), ...NOT_SHOPS, ...FOREIGN_MARKETS];
  const batches = await Promise.all(
    req.searchQueries.map((q) => searchWithCache(q, { maxResults: 15, depth: "advanced", excludeDomains })),
  );
  const allCached = batches.every((b) => b.cached);
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const r of batches.flatMap((b) => b.results)) {
    const k = r.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(k)) continue;
    seen.add(k);
    results.push(r);
  }

  if (!results.length) {
    return Response.json({
      ...emptyResult(req, allCached),
      note: searchEnabled() || allCached ? emptyNeedNote(req) : "Web search is not set up on this server. Paste a link you found, or upload a quotation.",
    } satisfies SourcingResponse);
  }

  // Search snippets often miss the price or a spec of a real product page: open the most
  // product-like of those pages (Tavily Extract, cached) and judge them on their own text.
  const toOpen = pickForExtract(results, { requirements: req.requirements, condition }, MAX_PAGES_TO_OPEN);
  if (toOpen.length) {
    const pages = await tavilyExtractMany(toOpen.map((r) => r.url));
    for (let i = 0; i < results.length; i++) {
      const text = pages.get(results[i].url);
      if (text) results[i] = { ...results[i], content: pageExcerpt(text) };
    }
  }

  const screened = screenResults(results, { requirements: req.requirements, condition });
  const screenNote = describeScreenDropped(screened.dropped, req.requirements);
  if (!screened.kept.length) {
    return Response.json({ ...emptyResult(req, allCached), note: [emptyNeedNote(req), screenNote].filter(Boolean).join(" ") } satisfies SourcingResponse);
  }

  const read = await readListings(req, screened.kept);
  if (!read) {
    return Response.json({
      ...emptyResult(req, allCached),
      note: "Listings were found but could not be read (AI unavailable). Try again, paste a link, or upload a quotation.",
    } satisfies SourcingResponse);
  }

  const ranked = rankListings(read.candidates, { maxPerDomain: MAX_PER_STORE, allowUsed: condition === "used" });
  const notes = ranked.options.length
    ? [
        !ranked.enoughData && `Fewer than 3 usable prices, so no market median.`,
        read.unverified > 0 && `${read.unverified} price${read.unverified > 1 ? "s" : ""} ignored because the number is not written in the listing.`,
        read.notProduct > 0 && `${read.notProduct} page${read.notProduct > 1 ? "s" : ""} listing several products skipped.`,
        screenNote,
        describeSourcingDropped(ranked.dropped),
        ranked.capped > 0 && `${ranked.capped} more from the same stores hidden (max ${MAX_PER_STORE} per store).`,
      ]
    : [emptyNeedNote(req), screenNote, describeSourcingDropped(ranked.dropped)];
  const response: SourcingResponse = {
    request: req,
    options: ranked.options,
    medianUnitPrice: ranked.medianUnitPrice,
    minUnitPrice: ranked.minUnitPrice,
    enoughData: ranked.enoughData,
    cached: allCached,
    simulated: ranked.options.some((o) => o.simulated),
    note: notes.filter(Boolean).join(" ") || null,
    searchedAt: new Date().toISOString(),
  };
  return Response.json(response);
}

function emptyResult(req: NeedRequest, cached: boolean): SourcingResponse {
  return {
    request: req,
    options: [],
    medianUnitPrice: null,
    minUnitPrice: null,
    enoughData: false,
    cached,
    simulated: false,
    note: null,
    searchedAt: new Date().toISOString(),
  };
}

// The cached Jack F5 entry carries its pre-read cleaning, so the demo answers instantly and offline.
function fromDemoCache(
  need: string,
  input: { qty: number | null; city: string | null; budget: number | null },
  entry: NonNullable<ReturnType<typeof lookupCacheByModel>>,
): SourcingResponse {
  const req = demoNeedRequest(need, input, entry.query);
  const candidates = candidatesFromCache(entry, req.item);
  const ranked = rankListings(candidates);
  const simulated = ranked.options.some((o) => o.simulated);
  const notes = [
    simulated &&
      "Simulated demo listings: no real PKR listings for this model were found online, so the team wrote these; links open marketplace searches.",
    !ranked.enoughData && "Not enough market data: fewer than 3 usable prices, so no median.",
    describeSourcingDropped(ranked.dropped),
  ].filter(Boolean);
  return {
    request: req,
    options: ranked.options,
    medianUnitPrice: ranked.medianUnitPrice,
    minUnitPrice: ranked.minUnitPrice,
    enoughData: ranked.enoughData,
    cached: true,
    simulated,
    note: notes.length ? notes.join(" ") : null,
    searchedAt: new Date().toISOString(),
  };
}

async function readListings(
  req: NeedRequest,
  kept: ScreenedResult<SearchResult>[],
): Promise<{ candidates: ListingCandidate[]; unverified: number; notProduct: number } | null> {
  const listing = kept.map(({ result: r }, i) => `[${i}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 3500)}`).join("\n\n");
  const specs = (req.requirements ?? []).filter((r) => r.mustHave).map((r) => r.label);
  const out = await aiJson(listingSchema, {
    tier: "read",
    maxTokens: 6000,
    system:
      "You read web pages from Pakistani shops to find products for sale. Return at most one listing per result: the main product " +
      "the page sells (skip results that sell nothing). pageType: 'product' only for a page selling one product; 'list' for search, " +
      "category or comparison pages with many products; 'article' for blogs/news/reviews. " +
      "pricePkr: the current price of ONE unit in PKR exactly as written; convert lakh exactly (3.5 lakh = 350000). " +
      "Do not estimate missing prices. Prices in other currencies (₹, $, ¥, AED) are not PKR: set pricePkr to null. " +
      "If only a total for several units, a monthly installment or a deposit is written, set pricePkr to null. " +
      "condition: 'used' / 'refurbished' only if the page says so (open-box counts as refurbished). " +
      "store: the shop or website brand, never a person. Contact email/phone only if written in the result.",
    prompt:
      `Owner wants: ${req.qty} × ${req.item}` +
      (specs.length ? ` (specs: ${specs.join(", ")})` : "") +
      (req.modelCandidates.length ? ` (models that fit: ${req.modelCandidates.join(", ")})` : "") +
      `, condition: ${req.condition ?? "new"}\n\nSearch results:\n\n${listing}`,
  });
  if (!out) return null;

  const wantUsed = req.condition === "used";
  let unverified = 0;
  let notProduct = 0;
  const used = new Set<number>();
  const candidates: ListingCandidate[] = [];
  for (const l of out.listings) {
    const screened = kept[l.index];
    if (!screened || used.has(l.index)) continue;
    used.add(l.index);
    const source = screened.result;
    if (l.pageType !== "product") {
      notProduct++;
      continue;
    }
    let price = l.pricePkr;
    // Code check: the price must be an amount actually written in this result's text.
    if (price != null) {
      const written = parseAmounts(`${source.title}\n${source.content}`).map((a) => a.value);
      if (!written.some((v) => Math.abs(v - price!) <= 1)) {
        console.warn(`[sourcing] price ${price} not in listing [${l.index}] (written: ${written.slice(0, 8).join(", ")})`);
        unverified++;
        price = null;
      }
    }
    const isUsed = l.condition === "used" || l.condition === "refurbished" || isUsedListing(source.title, source.content);
    candidates.push({
      seller: cleanStoreName(l.store, source.url),
      item: req.item,
      model: l.model?.trim() || null,
      title: source.title.replace(/\s+[|–-]\s+[^|–-]{2,40}$/, "").trim() || source.title,
      price,
      condition: isUsed ? "used" : wantUsed ? "unknown" : l.condition === "new" ? "new" : "unknown",
      // The AI can only exclude (an accessory or a different product); a match is decided by code.
      match: l.kind !== "same" ? "other" : screened.specStatus === "matched" ? "exact" : "close",
      url: source.url,
      contactEmail: l.contactEmail?.trim() || null,
      contactPhone: l.contactPhone?.trim() || null,
      simulated: source.simulated ?? false,
      specStatus: screened.specStatus,
      missingSpecs: screened.missingSpecs,
    });
  }
  return { candidates, unverified, notProduct };
}
