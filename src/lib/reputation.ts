// Reputation scoring (spec §7.3). The AI only reads reviews into ReviewPoints; these code rules
// decide the flag. Red flags go into the memo's risks and never change the money figures.
import type { ReputationFlag, ReviewPoint } from "./types";

// `relevant: false` = the AI judged the review to be about another supplier/model.
export type ScorableReview = ReviewPoint & { relevant?: boolean };

export const SERIOUS_COMPLAINTS: ReviewPoint["complaintType"][] = ["delivery", "warranty", "fraud"];
export const MIN_REVIEWS = 3;

export type ReputationScore = {
  flag: ReputationFlag;
  averageRating: number | null;
  reviews: ReviewPoint[];
  seriousCount: number;
  reasons: string[];
};

function dedupeKey(r: ReviewPoint): string {
  return r.quote.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreReputation(input: ScorableReview[], about: ReviewPoint["about"]): ReputationScore {
  // 1. Drop reviews about something else, then duplicates (same quote posted on several sites).
  const seen = new Set<string>();
  const reviews: ReviewPoint[] = [];
  for (const r of input) {
    if (r.relevant === false || r.about !== about || !r.quote.trim()) continue;
    const key = dedupeKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    reviews.push({ about: r.about, rating: r.rating, complaintType: r.complaintType, quote: r.quote, url: r.url });
  }

  const ratings = reviews
    .map((r) => r.rating)
    .filter((x): x is number => typeof x === "number" && x >= 0 && x <= 5);
  const averageRating = ratings.length ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
  const seriousCount = reviews.filter((r) => SERIOUS_COMPLAINTS.includes(r.complaintType)).length;
  const fraudCount = reviews.filter((r) => r.complaintType === "fraud").length;
  const counts = complaintSummary(reviews);

  // 2. Too few reviews: no flag either way.
  if (reviews.length < MIN_REVIEWS) {
    return {
      flag: "not_enough",
      averageRating,
      reviews,
      seriousCount,
      reasons: [`Only ${reviews.length} review${reviews.length === 1 ? "" : "s"} found (need ${MIN_REVIEWS}).`],
    };
  }

  const ratingText = averageRating == null ? "no star ratings" : `average ${averageRating.toFixed(1)} / 5`;

  // 3. Red flags: any fraud, average below 3, or 3+ serious complaints.
  const redReasons: string[] = [];
  if (fraudCount > 0) redReasons.push(`${fraudCount} fraud complaint${fraudCount > 1 ? "s" : ""}.`);
  if (averageRating != null && averageRating < 3) redReasons.push(`Low rating: ${ratingText}.`);
  if (seriousCount >= 3) redReasons.push(`${seriousCount} serious complaints (${counts}).`);
  if (redReasons.length) {
    return { flag: "red", averageRating, reviews, seriousCount, reasons: redReasons };
  }

  // 4. Good: average 4+ and at most one serious complaint.
  if (averageRating != null && averageRating >= 4 && seriousCount <= 1) {
    const reasons = [`${reviews.length} reviews, ${ratingText}.`];
    if (seriousCount === 1) reasons.push(`1 serious complaint (${counts}).`);
    return { flag: "good", averageRating, reviews, seriousCount, reasons };
  }

  // 5. Everything else is mixed.
  const reasons = [`${reviews.length} reviews, ${ratingText}.`];
  if (seriousCount) reasons.push(`${seriousCount} serious complaint${seriousCount > 1 ? "s" : ""} (${counts}).`);
  return { flag: "mixed", averageRating, reviews, seriousCount, reasons };
}

// "2 warranty, 1 delivery"
function complaintSummary(reviews: ReviewPoint[]): string {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    if (SERIOUS_COMPLAINTS.includes(r.complaintType)) counts.set(r.complaintType, (counts.get(r.complaintType) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(", ");
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
