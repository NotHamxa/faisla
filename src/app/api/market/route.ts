// POST { model, quotedUnitPrice, fresh? } → MarketResult.
// Pipeline (spec §7.2): search (cache first) → AI reads listings → code filters → medians → % above.
// Cached demo entries carry their pre-read cleaning, so the demo answers instantly without the web;
// `fresh: true` forces the AI to re-read cached listings. Every number below is computed in code.
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import { benchmarkFor } from "@/data/benchmarks";
import { aiJson } from "@/lib/ai";
import { DEMO_MODEL } from "@/lib/demoData";
import { describeDropped, filterMarketPrices, MIN_WEB_PRICES, type PriceCandidate } from "@/lib/marketPrices";
import { lookupCache, lookupCacheByModel, webSearch, type SearchResult } from "@/lib/search";
import type { MarketResult } from "@/lib/types";

const cleaningSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      seller: z.string(),
      pricePkr: z.number().int().nullable(),
      condition: z.enum(["new", "used", "unknown"]),
      exactModel: z.boolean(),
      url: z.string(),
    }),
  ),
});

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const body = (await request.json().catch(() => ({}))) as {
    model?: string;
    quotedUnitPrice?: number | null;
    fresh?: boolean;
  };
  const model = body.model?.trim() || DEMO_MODEL;
  const quotedUnitPrice = typeof body.quotedUnitPrice === "number" ? body.quotedUnitPrice : null;
  const query = `${model} price Pakistan`;

  const cachedEntry = lookupCache(query) ?? lookupCacheByModel(model);
  const results: SearchResult[] = cachedEntry ? cachedEntry.results : await webSearch(query);

  let candidates: PriceCandidate[] | null = null;
  if (cachedEntry?.cleaned && !body.fresh) {
    candidates = cachedEntry.cleaned.map((c) => toCandidate(results, c.index, c));
  } else if (results.length) {
    candidates = await cleanWithAi(model, results);
    // AI unavailable: fall back to the stored cleaning when there is one.
    if (!candidates && cachedEntry?.cleaned) {
      candidates = cachedEntry.cleaned.map((c) => toCandidate(results, c.index, c));
    }
  }

  const filtered = filterMarketPrices(candidates ?? []);
  const enoughData = filtered.kept.length >= MIN_WEB_PRICES;
  const benchmark = benchmarkFor(model);
  const webMedian = enoughData ? filtered.median : null;
  const reference = benchmark.median ?? webMedian;
  const pctAboveMarket = quotedUnitPrice != null && reference ? quotedUnitPrice / reference - 1 : null;

  const notes = [
    !enoughData && "Not enough market data from the web (need at least 3 new, exact-model prices).",
    describeDropped(filtered.dropped),
    benchmark.median == null && webMedian != null && "No benchmark for this model; % compared with the web median.",
    candidates == null && results.length > 0 && "Listings found but could not be read (AI unavailable).",
  ].filter(Boolean);

  const result: MarketResult = {
    model,
    quotedUnitPrice,
    benchmarkMedian: benchmark.median,
    benchmarkCount: benchmark.count,
    webPrices: filtered.kept,
    webMedian,
    pctAboveMarket,
    enoughData,
    cached: Boolean(cachedEntry),
    note: notes.length ? notes.join(" ") : undefined,
  };
  return Response.json(result);
}

function toCandidate(
  results: SearchResult[],
  index: number,
  c: { seller: string; price: number | null; condition: PriceCandidate["condition"]; exactModel: boolean; url?: string },
): PriceCandidate {
  const source = results[index];
  return {
    seller: c.seller,
    price: c.price,
    condition: c.condition,
    exactModel: c.exactModel,
    url: source?.url ?? c.url ?? "",
    title: source?.title,
    simulated: source?.simulated ?? false,
  };
}

async function cleanWithAi(model: string, results: SearchResult[]): Promise<PriceCandidate[] | null> {
  const listing = results
    .map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join("\n\n");
  const out = await aiJson(cleaningSchema, {
    system:
      "You read web search results about machine prices in Pakistan. Return one item per result, in order. " +
      "For each result, return seller, price in PKR, condition (new/used/unknown), exact model match (true/false), and the URL. " +
      "Do not estimate missing prices. Prices in other currencies are not PKR: set pricePkr to null. " +
      'Convert lakh notation exactly ("13.5 lakh" = 1350000).',
    prompt: `Target model: ${model}\n\nSearch results:\n\n${listing}`,
    maxTokens: 4000,
  });
  if (!out) return null;
  return out.items
    .filter((item) => item.index >= 0 && item.index < results.length)
    .map((item) => toCandidate(results, item.index, { ...item, price: item.pricePkr }));
}
