// Web search with a read-through cache. The demo never waits on the live web: every demo query is
// answered from src/data/cache/search.json (imported statically so it ships with the Vercel build).
// Live Tavily calls only happen on a cache miss when TAVILY_API_KEY is set.
import searchCache from "@/data/cache/search.json";
import type { MarketPrice } from "./types";

export type SearchResult = { title: string; url: string; content: string; simulated?: boolean };

// Pre-read AI cleaning output stored with demo entries (used when no AI key is set).
export type CachedCleanedPrice = {
  index: number; // position in results
  seller: string;
  price: number | null;
  condition: MarketPrice["condition"];
  exactModel: boolean;
};

export type SearchCacheEntry = {
  query: string;
  model?: string;
  fetchedAt: string;
  simulated?: boolean;
  results: SearchResult[];
  cleaned?: CachedCleanedPrice[];
};

// MarketPrice plus the "simulated" tag the UI shows next to demo listings.
export type TaggedMarketPrice = MarketPrice & { simulated?: boolean };

const fileEntries = (searchCache as unknown as { entries: Record<string, SearchCacheEntry> }).entries;
const runtimeEntries = new Map<string, SearchCacheEntry>(); // live results from this server process

export function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function searchEnabled(): boolean {
  return Boolean(process.env.TAVILY_API_KEY) && process.env.DEMO_MODE !== "1";
}

export function lookupCache(query: string): SearchCacheEntry | null {
  const key = normalizeQuery(query);
  return fileEntries[key] ?? runtimeEntries.get(key) ?? null;
}

// Market lookups by model: "Jack F5", "JACK F5" and "Jack F5-7" share the demo entry.
export function lookupCacheByModel(model: string): SearchCacheEntry | null {
  const key = model.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!key) return null;
  for (const entry of Object.values(fileEntries)) {
    const entryKey = (entry.model ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (entryKey && (entryKey.includes(key) || key.includes(entryKey.replace(/^juki/, "")))) return entry;
  }
  return null;
}

// Sellers that only exist in team-written simulated listings (fictional), kept for older cached entries.
export function isSimulatedSeller(name: string): boolean {
  const key = normalizeQuery(name);
  if (!key) return false;
  return Object.values(fileEntries).some((entry) =>
    (entry.cleaned ?? []).some((c) => entry.results[c.index]?.simulated && normalizeQuery(c.seller) === key),
  );
}

// Cache first, then Tavily. Returns [] when nothing is cached and search is unavailable or fails.
export async function webSearch(query: string, opts: { maxResults?: number } = {}): Promise<SearchResult[]> {
  const cached = lookupCache(query);
  if (cached) return cached.results;
  if (!searchEnabled()) return [];

  const results = await tavilySearch(query, opts.maxResults ?? 8);
  if (results.length) {
    const entry: SearchCacheEntry = { query, fetchedAt: new Date().toISOString(), results };
    runtimeEntries.set(normalizeQuery(query), entry);
    await persistInDev(normalizeQuery(query), entry);
  }
  return results;
}

async function tavilySearch(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      // Pakistani results first: local marketplaces (OLX, Daraz) list prices in PKR.
      body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", country: "pakistan" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[search] Tavily ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? "", url: r.url ?? "", content: (r.content ?? "").slice(0, 1500) }));
  } catch (error) {
    console.error("[search] Tavily request failed", error instanceof Error ? error.message : error);
    return [];
  }
}

// Dev only: append new live results to the cache file so rehearsal queries become demo-safe.
// Production (Vercel) has a read-only filesystem, so this is skipped there.
async function persistInDev(key: string, entry: SearchCacheEntry) {
  if (process.env.NODE_ENV !== "development") return;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), "src", "data", "cache", "search.json");
    const current = JSON.parse(await fs.readFile(file, "utf8")) as { entries: Record<string, SearchCacheEntry> };
    if (current.entries[key]) return;
    current.entries[key] = entry;
    await fs.writeFile(file, JSON.stringify(current, null, 2) + "\n", "utf8");
  } catch (error) {
    console.error("[search] could not write cache", error instanceof Error ? error.message : error);
  }
}
