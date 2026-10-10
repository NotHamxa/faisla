// POST { supplierName, model } → ReputationResult (plus `simulated` when served from demo reviews).
// supplierName set → reviews of that supplier; supplierName empty → reviews of the machine model.
// Cache first (demo-safe); on a miss with search + AI keys, the AI reads live results (spec §7.3).
// The flag itself always comes from the code rules in lib/reputation.ts.
import { z } from "zod";
import reviewsCache from "@/data/cache/reviews.json";
import { aiEnabled, aiJson } from "@/lib/ai";
import { scoreReputation, type ScorableReview } from "@/lib/reputation";
import { isSimulatedSeller, normalizeQuery, searchEnabled, webSearch } from "@/lib/search";
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
  // Loose match so "Al Noor Industrial Machines (Pvt) Ltd" or "AMS-221F" still hit the demo cache.
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
  const body = (await request.json().catch(() => ({}))) as { supplierName?: string; model?: string | null };
  const supplierName = body.supplierName?.trim() ?? "";
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
      reviews = await readLiveReviews(subject, about, model);
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

async function readLiveReviews(
  subject: string,
  about: ReviewPoint["about"],
  model: string | null,
): Promise<ScorableReview[]> {
  const query = about === "supplier" ? `"${subject}" reviews Pakistan` : `${subject} review`;
  const results = await webSearch(query, { maxResults: 8 });
  if (!results.length) return [];
  const listing = results.map((r, i) => `[${i}] ${r.title}\nURL: ${r.url}\n${r.content}`).join("\n\n");
  const out = await aiJson(reviewSchema, {
    system:
      "You read web search results for customer reviews. For each result, return: about (supplier or product), " +
      "rating out of 5 or null, complaint type (delivery, warranty, quality, service, fraud or none), a one-line quote, and the URL. " +
      "Do not invent ratings. Set relevant=false when the result is not a review of the named subject. " +
      "Skip results that contain no review at all.",
    prompt:
      `Subject (${about}): ${subject}` +
      (about === "supplier" && model ? `\nThey sell: ${model}` : "") +
      `\n\nSearch results:\n\n${listing}`,
    maxTokens: 4000,
  });
  return out?.reviews ?? [];
}
