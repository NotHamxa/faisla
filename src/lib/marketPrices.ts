// Code rules for cleaned web prices (spec §7.2). The AI only reads listings; these rules decide
// which prices count: new, exact model, a PKR price, and within 0.5×–2× of the median.
import { median } from "@/data/benchmarks";
import type { TaggedMarketPrice } from "./search";

export const MIN_WEB_PRICES = 3;

export type PriceCandidate = Omit<TaggedMarketPrice, "price"> & { price: number | null };

export type FilteredPrices = {
  kept: TaggedMarketPrice[];
  median: number | null;
  dropped: { used: number; otherModel: number; noPrice: number; outlier: number };
};

export function filterMarketPrices(candidates: PriceCandidate[]): FilteredPrices {
  const dropped = { used: 0, otherModel: 0, noPrice: 0, outlier: 0 };
  const valid: TaggedMarketPrice[] = [];
  for (const c of candidates) {
    if (c.price == null || !Number.isFinite(c.price) || c.price <= 0) dropped.noPrice++;
    else if (c.condition === "used") dropped.used++;
    else if (!c.exactModel) dropped.otherModel++;
    else valid.push({ ...c, price: Math.round(c.price) });
  }
  const mid = median(valid.map((p) => p.price));
  const kept = mid == null ? valid : valid.filter((p) => p.price >= 0.5 * mid && p.price <= 2 * mid);
  dropped.outlier = valid.length - kept.length;
  return { kept, median: median(kept.map((p) => p.price)), dropped };
}

export function describeDropped(d: FilteredPrices["dropped"]): string | null {
  const parts = [
    d.used && `${d.used} used`,
    d.otherModel && `${d.otherModel} different model`,
    d.noPrice && `${d.noPrice} without a PKR price`,
    d.outlier && `${d.outlier} outlier${d.outlier > 1 ? "s" : ""}`,
  ].filter(Boolean);
  const total = d.used + d.otherModel + d.noPrice + d.outlier;
  return total ? `${total} result${total > 1 ? "s" : ""} dropped: ${parts.join(", ")}.` : null;
}
