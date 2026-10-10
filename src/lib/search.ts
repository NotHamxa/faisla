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

export type SearchOptions = {
  maxResults?: number;
  depth?: "basic" | "advanced"; // advanced = better product-page snippets (2 credits)
  excludeDomains?: string[];
};

// Live results are cached per query and options, so a retail-only search never reuses a broad one.
function runtimeKey(query: string, opts: SearchOptions): string {
  const extra = [opts.depth === "advanced" ? "adv" : "", ...(opts.excludeDomains ?? []).map((d) => `-${d}`)].filter(Boolean);
  return [normalizeQuery(query), ...extra].join(" ");
}

// Cache first, then Tavily. Returns [] when nothing is cached and search is unavailable or fails.
export async function webSearch(query: string, opts: SearchOptions = {}): Promise<SearchResult[]> {
  return (await searchWithCache(query, opts)).results;
}

// Same as webSearch, also saying whether the answer came from the cache (no live call).
export async function searchWithCache(query: string, opts: SearchOptions = {}): Promise<{ results: SearchResult[]; cached: boolean }> {
  const fileHit = fileEntries[normalizeQuery(query)];
  if (fileHit) return { results: fileHit.results, cached: true };
  const key = runtimeKey(query, opts);
  const runtimeHit = runtimeEntries.get(key);
  if (runtimeHit) return { results: runtimeHit.results, cached: true };
  if (!searchEnabled()) return { results: [], cached: false };

  const results = await tavilySearch(query, opts);
  if (results.length) {
    const entry: SearchCacheEntry = { query, fetchedAt: new Date().toISOString(), results };
    runtimeEntries.set(key, entry);
    // Only the plain search goes to the dev cache file (keyed by query alone).
    if (key === normalizeQuery(query)) await persistInDev(key, entry);
  }
  return { results, cached: false };
}

async function tavilySearch(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const advanced = opts.depth === "advanced";
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      // Pakistani results first: local shops list prices in PKR.
      body: JSON.stringify({
        query,
        max_results: opts.maxResults ?? 8,
        search_depth: advanced ? "advanced" : "basic",
        ...(advanced ? { chunks_per_source: 3 } : {}),
        country: "pakistan",
        ...(opts.excludeDomains?.length ? { exclude_domains: opts.excludeDomains } : {}),
      }),
      signal: AbortSignal.timeout(advanced ? 15000 : 8000),
    });
    if (!res.ok) {
      console.error(`[search] Tavily ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? "", url: r.url ?? "", content: (r.content ?? "").slice(0, advanced ? 2500 : 1500) }));
  } catch (error) {
    console.error("[search] Tavily request failed", error instanceof Error ? error.message : error);
    return [];
  }
}

// Tavily Extract: the readable text of one page, fetched by Tavily (our server never opens the URL).
// null when search is off or the page could not be read.
export async function tavilyExtract(url: string): Promise<string | null> {
  return (await tavilyExtractMany([url])).get(url) ?? null;
}

const extractCache = new Map<string, string>(); // per server process

// Several pages in one call (1 credit per 5 pages). With `query`, Tavily returns the chunks most
// relevant to it (price and specs) instead of the whole page. Pages that fail are simply missing.
export async function tavilyExtractMany(urls: string[], opts: { query?: string } = {}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const keyOf = (u: string) => `${opts.query ?? ""}|${u}`;
  const todo = urls.filter((u) => {
    const hit = extractCache.get(keyOf(u));
    if (hit) out.set(u, hit);
    return !hit;
  });
  if (!todo.length || !searchEnabled()) return out;
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({
        urls: todo.slice(0, 20),
        extract_depth: "basic",
        format: "text",
        timeout: 12,
        ...(opts.query ? { query: opts.query, chunks_per_source: 4 } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[search] Tavily extract ${res.status}`);
      return out;
    }
    const data = (await res.json()) as { results?: { url?: string; raw_content?: string }[] };
    for (const r of data.results ?? []) {
      const text = r.raw_content?.trim();
      // Tavily may normalise the URL: match it back to the one we asked for.
      const asked = todo.find((u) => u === r.url) ?? todo.find((u) => r.url && u.replace(/\/$/, "") === r.url.replace(/\/$/, ""));
      if (!asked || !text) continue;
      out.set(asked, text);
      extractCache.set(keyOf(asked), text);
    }
  } catch (error) {
    console.error("[search] Tavily extract failed", error instanceof Error ? error.message : error);
  }
  return out;
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
