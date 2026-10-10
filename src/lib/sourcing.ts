// Pure helpers for "Describe what you need": web listings → ranked options → offers.
// No AI and no I/O. The AI only reads listings; these rules decide which ones count (spec §7.2):
// a written PKR price, not used, a matching model, no duplicates, within 0.5×–2× of the median.
// Every total is computed here (qty × unit price), never read from a listing or a model.
import { median } from "@/data/benchmarks";
import { DEMO_ITEM, DEMO_MODEL } from "./demoData";
import type { SearchCacheEntry } from "./search";
import type { NeedRequest, Offer, Quotation, SourcedOption, SourcingResult } from "./types";

// What POST /api/sourcing returns; the client adds the owner's selection to make a SourcingResult.
export type SourcingResponse = Omit<SourcingResult, "selectedIds">;

export const MIN_SOURCED_PRICES = 3;
export const MAX_SELECTED_OPTIONS = 3;
export const WEB_OFFER_PREFIX = "offer-web-";

// What the AI (or the stored demo cleaning) read from one search result, before the code rules.
export type ListingCandidate = {
  seller: string;
  item: string;
  model: string | null;
  title: string;
  price: number | null; // PKR per unit as written, or null
  condition: "new" | "used" | "unknown";
  match: "exact" | "close" | "other"; // does the listing fit what the owner asked for
  url: string;
  contactEmail: string | null;
  contactPhone: string | null;
  simulated: boolean;
};

export type SourcingDropped = { noPrice: number; used: number; otherModel: number; duplicate: number; outlier: number };

export type RankedListings = {
  options: SourcedOption[];
  medianUnitPrice: number | null; // null when fewer than MIN_SOURCED_PRICES remain
  minUnitPrice: number | null;
  enoughData: boolean;
  dropped: SourcingDropped;
};

function key(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function rankListings(candidates: ListingCandidate[]): RankedListings {
  const dropped: SourcingDropped = { noPrice: 0, used: 0, otherModel: 0, duplicate: 0, outlier: 0 };

  const valid: (ListingCandidate & { price: number })[] = [];
  for (const c of candidates) {
    if (c.price == null || !Number.isFinite(c.price) || c.price <= 0) dropped.noPrice++;
    else if (c.condition === "used") dropped.used++;
    else if (c.match === "other") dropped.otherModel++;
    else valid.push({ ...c, price: Math.round(c.price) });
  }

  // Same seller and model listed twice (two search queries, two marketplaces): keep the cheaper one.
  const bySellerModel = new Map<string, ListingCandidate & { price: number }>();
  for (const c of valid) {
    const k = `${key(c.seller)}|${key(c.model)}`;
    const seen = bySellerModel.get(k);
    if (!seen) bySellerModel.set(k, c);
    else {
      dropped.duplicate++;
      if (c.price < seen.price) bySellerModel.set(k, c);
    }
  }
  const unique = [...bySellerModel.values()];

  const mid = median(unique.map((c) => c.price));
  const kept = mid == null ? unique : unique.filter((c) => c.price >= 0.5 * mid && c.price <= 2 * mid);
  dropped.outlier = unique.length - kept.length;

  kept.sort((a, b) => a.price - b.price || a.seller.localeCompare(b.seller));
  const options: SourcedOption[] = kept.map((c, i) => ({
    id: `opt-${i + 1}`,
    seller: c.seller.trim() || "Unnamed seller",
    item: c.item,
    model: c.model,
    title: c.title,
    unitPrice: c.price,
    condition: c.condition === "new" ? "new" : "unknown",
    exactModel: c.match === "exact",
    url: c.url,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    simulated: c.simulated,
  }));

  const enoughData = options.length >= MIN_SOURCED_PRICES;
  return {
    options,
    medianUnitPrice: enoughData ? median(options.map((o) => o.unitPrice)) : null,
    minUnitPrice: options.length ? options[0].unitPrice : null,
    enoughData,
    dropped,
  };
}

export function describeSourcingDropped(d: SourcingDropped): string | null {
  const parts = [
    d.noPrice && `${d.noPrice} without a PKR price`,
    d.used && `${d.used} used`,
    d.otherModel && `${d.otherModel} not matching`,
    d.duplicate && `${d.duplicate} duplicate${d.duplicate > 1 ? "s" : ""}`,
    d.outlier && `${d.outlier} outlier${d.outlier > 1 ? "s" : ""}`,
  ].filter(Boolean);
  const total = d.noPrice + d.used + d.otherModel + d.duplicate + d.outlier;
  return total ? `${total} listing${total > 1 ? "s" : ""} left out: ${parts.join(", ")}.` : null;
}

export function optionTotal(option: Pick<SourcedOption, "unitPrice">, qty: number): number {
  return qty * option.unitPrice;
}

// Positive `over` = how much the total exceeds the owner's budget. null when no budget was given.
export function budgetFit(total: number, budget: number | null): { within: boolean; over: number } | null {
  if (budget == null || !(budget > 0)) return null;
  return { within: total <= budget, over: total - budget };
}

// A chosen listing becomes an offer: cash only (listings carry no installment terms), total computed here.
export function optionToOffer(option: SourcedOption, qty: number, index: number): Offer {
  return {
    id: `${WEB_OFFER_PREFIX}${index + 1}`,
    supplierName: option.seller,
    supplierEmail: option.contactEmail,
    item: option.item,
    model: option.model,
    qty,
    unitPrice: option.unitPrice,
    total: optionTotal(option, qty),
    cashDiscountPct: null,
    installmentMonths: null,
    installmentAmount: null,
    firstInstallmentOnDelivery: false,
    source: "web",
    sourceLink: option.url || null,
    receivedAt: new Date().toISOString(),
    summary: `Web listing${option.simulated ? " (simulated)" : ""}: ${option.title}`,
  };
}

// The chosen (cheapest) listing in the shape downstream steps read from state.quotation:
// item, model, qty and the listed unit price. Nothing else was printed, so everything else is null.
export function needToQuotation(option: SourcedOption, need: NeedRequest): Quotation {
  return {
    supplierName: option.seller,
    supplierPhone: null,
    supplierEmail: null,
    quoteDate: null,
    items: [
      {
        description: need.item,
        model: option.model ?? need.modelCandidates[0] ?? null,
        qty: need.qty,
        unitPrice: option.unitPrice,
        lineTotal: null,
      },
    ],
    printedTotal: null,
    cashDiscountPct: null,
    installmentMonths: null,
    installmentAmount: null,
    firstInstallmentOnDelivery: null,
    markupClaimedPct: null,
    validityDays: null,
  };
}

// The rehearsed demo need (Jack F5 / direct-drive lockstitch) is answered from the cached real Jack F5
// listings, never from the live web.
export function isDemoNeed(need: string): boolean {
  return /\bjack\s*-?\s*f5\b|direct[\s-]*drive\b[^.]{0,40}?\block\s*-?\s*stitch/i.test(need);
}

// "80 direct-drive lockstitch sewing machines" → 80. Only a number in front of a unit word counts.
export function parseNeedQty(need: string): number | null {
  const m = /(?<![\d.,])(\d{1,3})\s*(?:x|×)?\s+(?:[a-z][a-z-]*\s+){0,4}?(machines?|units?|pcs|pieces|sets?|sewers?|nos)\b/i.exec(need);
  const n = m ? parseInt(m[1], 10) : NaN;
  return n > 0 ? n : null;
}

const CITIES = [
  "Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad", "Gujranwala", "Multan", "Sialkot", "Peshawar", "Quetta",
  "Hyderabad", "Sargodha", "Bahawalpur", "Sheikhupura", "Gujrat", "Kasur", "Sahiwal", "Okara", "Mardan", "Abbottabad",
];

// "... for Lahore, budget 20 lakh" → "Lahore". The first Pakistani city named in the need, or null.
export function cityInNeed(need: string): string | null {
  let best: { city: string; at: number } | null = null;
  for (const city of CITIES) {
    const at = need.search(new RegExp(`\\b${city}\\b`, "i"));
    if (at >= 0 && (!best || at < best.at)) best = { city, at };
  }
  return best?.city ?? null;
}

// Structured request for the demo need, built in code (no AI call needed for the rehearsed path).
export function demoNeedRequest(
  need: string,
  input: { qty: number | null; city: string | null; budget: number | null },
  query: string,
): NeedRequest {
  return {
    need,
    item: DEMO_ITEM,
    modelCandidates: [DEMO_MODEL],
    qty: input.qty ?? parseNeedQty(need) ?? 1,
    city: input.city,
    budgetPkr: input.budget,
    searchQueries: [query],
  };
}

// A cached search entry with its stored cleaning (the demo Jack F5 listings) → candidates, no AI call.
export function candidatesFromCache(entry: SearchCacheEntry, item: string): ListingCandidate[] {
  return (entry.cleaned ?? []).map((c) => {
    const source = entry.results[c.index];
    return {
      seller: c.seller,
      item,
      model: c.exactModel ? (entry.model ?? DEMO_MODEL) : null,
      title: source?.title ?? "",
      price: c.price,
      condition: c.condition,
      match: c.exactModel ? "exact" : "other",
      url: source?.url ?? "",
      contactEmail: null,
      contactPhone: null,
      simulated: source?.simulated ?? entry.simulated ?? false,
    };
  });
}

// Owner's selection, in price order, capped at MAX_SELECTED_OPTIONS.
export function selectedOptions(options: SourcedOption[], ids: string[]): SourcedOption[] {
  return options.filter((o) => ids.includes(o.id)).slice(0, MAX_SELECTED_OPTIONS);
}
