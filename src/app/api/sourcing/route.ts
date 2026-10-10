// POST { need, qty?, city?, budget? } → SourcingResponse (or NeedsOwnerInput).
// "Describe what you need": AI structures the need → search (cache first) → AI reads listings →
// code checks each price is written in the listing, filters, dedupes, ranks and takes the median.
// The rehearsed demo need (pattern sewer / JUKI AMS-221F) is answered from the cached, labelled
// simulated listings without any network call.
import { z } from "zod";
import { aiEnabled, aiJson } from "@/lib/ai";
import { DEMO_MODEL } from "@/lib/demoData";
import { parseAmounts } from "@/lib/replyParser";
import { lookupCache, lookupCacheByModel, searchEnabled, webSearch, type SearchResult } from "@/lib/search";
import {
  candidatesFromCache,
  cityInNeed,
  demoNeedRequest,
  describeSourcingDropped,
  isDemoNeed,
  type ListingCandidate,
  parseNeedQty,
  rankListings,
  type SourcingResponse,
} from "@/lib/sourcing";
import type { NeedRequest, NeedsOwnerInput } from "@/lib/types";

export const maxDuration = 60;

const inputSchema = z.object({
  need: z.string().trim().min(3).max(600),
  qty: z.number().int().min(1).max(1000).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  budget: z.number().int().min(1).max(100_000_000_000).nullable().optional(),
});

// AI schemas: strict structured outputs, so nullable (never optional).
const requestSchema = z.object({
  item: z.string().describe("Short generic name of the machine or equipment, e.g. 'Industrial embroidery machine'"),
  modelCandidates: z.array(z.string()).describe("Specific brand/model names that fit, most likely first; empty if none named or obvious"),
  qty: z.number().int().nullable().describe("How many units the owner wants, or null if not said"),
  budgetPkr: z.number().int().nullable().describe("Total budget in PKR as written (60 lakh = 6000000), or null if not said"),
  city: z.string().nullable().describe("City named in the need, or null"),
  searchQueries: z.array(z.string()).describe("1 to 3 web search queries to find new units for sale in Pakistan with prices"),
});

const listingSchema = z.object({
  listings: z.array(
    z.object({
      index: z.number().int().describe("Index [n] of the search result this listing comes from"),
      seller: z.string().describe("Seller or shop name as written; the website name if no seller is given"),
      model: z.string().nullable().describe("Brand and model as written, or null"),
      pricePkr: z.number().int().nullable().describe("Price per unit in PKR exactly as written, or null. Do not estimate."),
      condition: z.enum(["new", "used", "unknown"]),
      match: z.enum(["exact", "close", "other"]).describe("exact = the requested model; close = same kind of machine; other = different kind"),
      contactEmail: z.string().nullable(),
      contactPhone: z.string().nullable(),
    }),
  ),
});

function needsOwnerInput(reason: string) {
  return Response.json({ needsOwnerInput: true, reason } satisfies NeedsOwnerInput);
}

// Amounts the owner actually wrote ("budget around 60 lakh" → 6000000). The largest one is the budget.
function writtenBudget(need: string): number | null {
  const amounts = parseAmounts(need).map((a) => a.value);
  return amounts.length ? Math.max(...amounts) : null;
}

export async function POST(request: Request) {
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

  const structured = await aiJson(requestSchema, {
    tier: "fast",
    maxTokens: 800,
    system:
      "You turn a Pakistani business owner's purchase need into a structured request for a web search. " +
      "Copy numbers exactly as written; convert lakh/crore exactly (60 lakh = 6000000, 1.2 crore = 12000000). " +
      "Never guess a budget or quantity that is not written. Search queries must look for NEW units for sale in Pakistan " +
      "with prices, the way a buyer searches marketplaces and dealers (e.g. '<item> price in Pakistan', '<item> for sale olx <city>', " +
      "'<brand model> price daraz'); include common brand names in queries when the owner named none; at most 3 queries.",
    prompt: `Owner's need: ${need}${!needCity && input.city ? `\nOwner's city (from their profile): ${input.city}` : ""}`,
  });
  if (!structured) return needsOwnerInput("Faisla couldn't understand that need right now. Try again, or upload a quotation instead.");

  const amounts = parseAmounts(need).map((a) => a.value);
  // The AI's budget only counts if the owner actually wrote that amount.
  const aiBudget = structured.budgetPkr != null && amounts.some((v) => Math.abs(v - structured.budgetPkr!) <= 1) ? structured.budgetPkr : null;
  const aiQty = structured.qty != null && structured.qty > 0 && structured.qty <= 1000 ? structured.qty : null;
  const aiCity = structured.city?.trim() || null;
  // Two AI queries plus one marketplace query: OLX listing pages carry PKR prices in their snippets.
  const queries = [
    ...new Set([
      ...structured.searchQueries.map((q) => q.trim()).filter(Boolean).slice(0, 2),
      `${structured.item.trim() || need.slice(0, 60)} price olx Pakistan`,
    ]),
  ];
  const req: NeedRequest = {
    need,
    item: structured.item.trim() || need.slice(0, 80),
    modelCandidates: structured.modelCandidates.map((m) => m.trim()).filter(Boolean).slice(0, 5),
    qty: input.qty ?? aiQty ?? parseNeedQty(need) ?? 1,
    // A city written in the need beats the form's default (the company's city).
    city: needCity ?? (aiCity && need.toLowerCase().includes(aiCity.toLowerCase()) ? aiCity : null) ?? input.city,
    budgetPkr: input.budget ?? aiBudget,
    searchQueries: queries.length ? queries : [`${structured.item} price Pakistan`],
  };

  // Search: cache first per query, live only on a miss. Results deduped by URL + title.
  let allCached = true;
  const batches = await Promise.all(
    req.searchQueries.map(async (q) => {
      const hit = lookupCache(q);
      if (hit) return hit.results;
      allCached = false;
      return webSearch(q, { maxResults: 6 });
    }),
  );
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const r of batches.flat()) {
    const k = `${r.url}|${r.title}`;
    if (seen.has(k)) continue;
    seen.add(k);
    results.push(r);
  }

  if (!results.length) {
    return Response.json({
      ...emptyResult(req, allCached),
      note: searchEnabled() || allCached ? "No listings found for this need. Try other words, or upload a quotation." : "Web search is not set up on this server.",
    } satisfies SourcingResponse);
  }

  const read = await readListings(req, results);
  if (!read) {
    return Response.json({
      ...emptyResult(req, allCached),
      note: "Listings were found but could not be read (AI unavailable). Try again, or upload a quotation.",
    } satisfies SourcingResponse);
  }

  const ranked = rankListings(read.candidates);
  const notes = [
    !ranked.enoughData && `Not enough market data: fewer than 3 usable prices, so no median.`,
    read.unverified > 0 && `${read.unverified} price${read.unverified > 1 ? "s" : ""} ignored because the number is not written in the listing.`,
    describeSourcingDropped(ranked.dropped),
  ].filter(Boolean);
  const response: SourcingResponse = {
    request: req,
    options: ranked.options,
    medianUnitPrice: ranked.medianUnitPrice,
    minUnitPrice: ranked.minUnitPrice,
    enoughData: ranked.enoughData,
    cached: allCached,
    simulated: ranked.options.some((o) => o.simulated),
    note: notes.length ? notes.join(" ") : null,
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

// The cached JUKI entry carries its pre-read cleaning, so the demo answers instantly and offline.
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
  results: SearchResult[],
): Promise<{ candidates: ListingCandidate[]; unverified: number } | null> {
  const listing = results.map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 1200)}`).join("\n\n");
  const out = await aiJson(listingSchema, {
    tier: "read",
    maxTokens: 3000,
    system:
      "You read web search results to find machines for sale in Pakistan. Return one listing per seller offer you find " +
      "(a result may contain several, or none: skip articles and spec sheets without a seller). " +
      "pricePkr: the price per unit in PKR exactly as written; convert lakh exactly (13.5 lakh = 1350000). " +
      "Do not estimate missing prices. Prices in other currencies (₹, $, ¥) are not PKR: set pricePkr to null. " +
      "If only a total for several units is written, set pricePkr to null. Contact email/phone only if written in the result.",
    prompt:
      `Owner wants: ${req.qty} × ${req.item}` +
      (req.modelCandidates.length ? ` (models that fit: ${req.modelCandidates.join(", ")})` : "") +
      `\n\nSearch results:\n\n${listing}`,
  });
  if (!out) return null;

  let unverified = 0;
  const candidates: ListingCandidate[] = [];
  for (const l of out.listings) {
    const source = results[l.index];
    if (!source) continue;
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
    candidates.push({
      seller: l.seller,
      item: req.item,
      model: l.model?.trim() || null,
      title: source.title,
      price,
      condition: l.condition,
      match: l.match,
      url: source.url,
      contactEmail: l.contactEmail?.trim() || null,
      contactPhone: l.contactPhone?.trim() || null,
      simulated: source.simulated ?? false,
    });
  }
  return { candidates, unverified };
}
