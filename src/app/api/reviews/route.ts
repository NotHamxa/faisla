// POST { supplierName, model, sourceLink? } → ReputationResult (plus `simulated` when served from demo reviews).
// supplierName set → reviews of that supplier (store name, and its website when the offer has a link);
// supplierName empty → reviews of the product model.
// Cache first (demo-safe); on a miss with search + AI keys, the AI reads live results (spec §7.3).
// The flag itself always comes from the code rules in lib/reputation.ts.
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import reviewsCache from "@/data/cache/reviews.json";
import { aiEnabled, aiJson } from "@/lib/ai";
import { scoreReputation, type ScorableReview } from "@/lib/reputation";
import { isSimulatedSeller, normalizeQuery, searchEnabled, webSearch, type SearchResult } from "@/lib/search";
import { domainOf, USED_MARKETPLACES } from "@/lib/sourcing";
import type { ReputationResult, ReviewPoint } from "@/lib/types";

type CachedReviews = { name: string; about: ReviewPoint["about"]; simulated?: boolean; reviews: ScorableReview[] };
const cacheEntries = (reviewsCache as unknown as { entries: Record<string, CachedReviews> }).entries;

const reviewSchema = z.object({
  reviews: z.array(
    z.object({
      about: z.enum(["supplier", "product"]),
      relevant: z.boolean(),
      rating: z.number().min(0).max(5).nullable(),
      complaintType: z.enum(["delivery", "warranty", "quality", "service", "fraud", "none"]),
      quote: z.string(),
      url: z.string(),
    }),
  ),
});

function lookupReviews(name: string, about: ReviewPoint["about"]): CachedReviews | null {
  const key = normalizeQuery(name);
  if (cacheEntries[key]) return cacheEntries[key];
  // Loose match so "Al Noor Industrial Machines (Pvt) Ltd" or "JACK F5" still hit the demo cache.
  const compact = key.replace(/ /g, "");
  for (const [entryKey, entry] of Object.entries(cacheEntries)) {
    const entryCompact = entryKey.replace(/ /g, "");
    if (entry.about === about && (compact.includes(entryCompact) || entryCompact.replace(/^juki/, "") === compact)) {
      return entry;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const body = (await request.json().catch(() => ({}))) as { supplierName?: string; model?: string | null; sourceLink?: string | null };
  const supplierName = body.supplierName?.trim() ?? "";
  const sourceLink = typeof body.sourceLink === "string" ? body.sourceLink.trim() : "";
  const model = body.model?.trim() || null;
  const about: ReviewPoint["about"] = supplierName ? "supplier" : "product";
  const subject = supplierName || model || "";

  if (!subject) {
    return Response.json({ needsOwnerInput: true, reason: "Supplier name or model required" }, { status: 400 });
  }

  const cached = lookupReviews(subject, about);
  let reviews: ScorableReview[] = cached?.reviews ?? [];
  let note: string | null = null;

  if (!cached) {
    if (about === "supplier" && isSimulatedSeller(subject)) {
      // Sellers from the team-written demo listings are fictional: searching could match a real namesake.
      note = "Simulated demo listing: this seller is fictional, so there are no reviews to search.";
    } else if (searchEnabled() && aiEnabled()) {
      reviews = await readLiveReviews(subject, about, model, sourceLink);
    } else {
      note = "No cached reviews and live search is off.";
    }
  }

  const score = scoreReputation(reviews, about);
  const result: ReputationResult & { simulated: boolean } = {
    supplierName,
    model,
    flag: score.flag,
    averageRating: score.averageRating,
    reviews: score.reviews,
    reasons: note ? [...score.reasons, note] : score.reasons,
    cached: Boolean(cached),
    simulated: Boolean(cached?.simulated),
  };
  return Response.json(result);
}

// "Galaxy Tech (Pvt) Ltd" → "Galaxy Tech": legal suffixes only make the search miss.
function searchName(name: string): string {
  return name.replace(/\(?\b(pvt|private)\.?\)?\s*(ltd|limited)?\.?/gi, " ").replace(/\s+/g, " ").trim() || name;
}

async function readLiveReviews(
  subject: string,
  about: ReviewPoint["about"],
  model: string | null,
  sourceLink: string,
): Promise<ScorableReview[]> {
  const name = searchName(subject);
  // A store's own website (not a marketplace like OLX) is the best handle for its reviews.
  const domain = sourceLink ? domainOf(sourceLink) : "";
  const storeDomain = domain && !USED_MARKETPLACES.some((d) => domain.endsWith(d)) ? domain : "";
  const queries =
    about === "supplier"
      ? [`${name} reviews Pakistan`, storeDomain ? `${storeDomain} reviews` : `${name} customer reviews complaints`]
      : [`${name} review`];
  const batches = await Promise.all(queries.map((q) => webSearch(q, { maxResults: 8, depth: about === "supplier" ? "advanced" : "basic" })));
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const r of batches.flat()) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    results.push(r);
  }
  if (!results.length) return [];
  const listing = results
    .slice(0, 12)
    .map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 1500)}`)
    .join("\n\n");
  const out = await aiJson(reviewSchema, {
    // A store name is easy to confuse with a namesake abroad: the better reader for store reviews.
    tier: about === "supplier" ? "read" : "fast",
    system:
      "You read web search results for customer reviews. A result may hold several separate customer reviews " +
      "(review sites, forums, Google/Facebook/Trustpilot pages): return each one, at most 4 per result. For each review return: " +
      "about ('supplier' when it is about the store or its service, delivery, warranty; 'product' when about the product itself), " +
      "rating out of 5 or null, complaint type (delivery, warranty, quality, service, fraud or none), a one-line quote copied " +
      "from the review, and the URL of the result. Do not invent ratings or reviews. Set relevant=false when the review is " +
      "not about the named subject (another store with a similar name, another product). Skip results that contain no review.",
    prompt:
      `Subject (${about}): ${subject}` +
      (storeDomain ? `\nTheir website: ${storeDomain}` : "") +
      (about === "supplier" && model ? `\nThey sell: ${model}` : "") +
      `\n\nSearch results:\n\n${listing}`,
    maxTokens: 4000,
  });
  // Code checks on what the AI read: only links that were in the search results; never employer
  // reviews; for a store with a website, only pages that name that website (a namesake abroad
  // doesn't count) and not the store's own testimonials page.
  const byUrl = new Map(results.map((r) => [r.url, r]));
  return (out?.reviews ?? []).filter((r) => {
    const source = byUrl.get(r.url);
    if (!source) return false;
    const host = domainOf(r.url);
    if (EMPLOYER_SITES.some((d) => host === d || host.endsWith(`.${d}`))) return false;
    if (about !== "supplier" || !storeDomain) return true;
    if (host === storeDomain || host.endsWith(`.${storeDomain}`)) return false;
    return `${source.url} ${source.title} ${source.content}`.toLowerCase().includes(storeDomain);
  });
}

const EMPLOYER_SITES = ["indeed.com", "glassdoor.com", "rozee.pk", "ambitionbox.com", "comparably.com"];
