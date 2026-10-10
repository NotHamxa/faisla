// Pure helpers for "Describe what you need": web listings → ranked options → offers.
// No AI and no I/O. The AI only reads listings; these rules decide which ones count (spec §7.2):
// a written PKR price, not used, a matching model, no duplicates, within 0.5×–2× of the median.
// Every total is computed here (qty × unit price), never read from a listing or a model.
import { median } from "@/data/benchmarks";
import { DEMO_ITEM, DEMO_MODEL } from "./demoData";
import type { SearchCacheEntry } from "./search";
import { parseAmounts } from "./replyParser";
import type { NeedRequest, Offer, Quotation, SourcedOption, SourcingResult, SpecRequirement, SpecStatus } from "./types";

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
  specStatus?: Exclude<SpecStatus, "mismatch">; // set on live listings by checkRequirements (code)
  missingSpecs?: string[];
};

export type SourcingDropped = { noPrice: number; used: number; otherModel: number; duplicate: number; outlier: number };

export type RankedListings = {
  options: SourcedOption[];
  medianUnitPrice: number | null; // null when fewer than MIN_SOURCED_PRICES remain
  minUnitPrice: number | null;
  enoughData: boolean;
  dropped: SourcingDropped;
  capped: number; // left out by the per-store cap (live search only)
};

export type RankOptions = {
  maxPerDomain?: number; // live search: at most this many options from one website
  allowUsed?: boolean; // the owner asked for used
};

function key(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function rankListings(candidates: ListingCandidate[], opts: RankOptions = {}): RankedListings {
  const dropped: SourcingDropped = { noPrice: 0, used: 0, otherModel: 0, duplicate: 0, outlier: 0 };

  const valid: (ListingCandidate & { price: number })[] = [];
  for (const c of candidates) {
    if (c.price == null || !Number.isFinite(c.price) || c.price <= 0) dropped.noPrice++;
    else if (c.condition === "used" && !opts.allowUsed) dropped.used++;
    else if (c.match === "other") dropped.otherModel++;
    else valid.push({ ...c, price: Math.round(c.price) });
  }

  // Same seller and model listed twice (two search queries, two marketplaces): keep the cheaper one.
  // Without a model, the listing title stands in (two different products from one store both count).
  const bySellerModel = new Map<string, ListingCandidate & { price: number }>();
  for (const c of valid) {
    const k = `${key(c.seller)}|${key(c.model) || key(c.title)}`;
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

  // Spec-matched listings first (cheapest first), then the ones code couldn't check.
  kept.sort((a, b) => statusRank(a) - statusRank(b) || a.price - b.price || a.seller.localeCompare(b.seller));
  let capped = 0;
  const perDomain = new Map<string, number>();
  const shown = opts.maxPerDomain
    ? kept.filter((c) => {
        const d = domainOf(c.url) || key(c.seller);
        const n = perDomain.get(d) ?? 0;
        if (n >= opts.maxPerDomain!) {
          capped++;
          return false;
        }
        perDomain.set(d, n + 1);
        return true;
      })
    : kept;
  const options: SourcedOption[] = shown.map((c, i) => ({
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
    ...(c.specStatus ? { specStatus: c.specStatus } : {}),
    ...(c.missingSpecs?.length ? { missingSpecs: c.missingSpecs } : {}),
  }));

  const enoughData = options.length >= MIN_SOURCED_PRICES;
  return {
    options,
    medianUnitPrice: enoughData ? median(options.map((o) => o.unitPrice)) : null,
    minUnitPrice: options.length ? options[0].unitPrice : null,
    enoughData,
    dropped,
    capped,
  };
}

function statusRank(c: ListingCandidate): number {
  return c.specStatus === "unverified" ? 1 : 0;
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

/* ---------- Live search rules (code checks what the AI read) ---------- */

// "https://www.czone.com.pk/x" → "czone.com.pk". "" when the URL can't be parsed.
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return "";
  }
}

const SECOND_LEVEL = /\.(com|net|org|edu|gov|co|web)\.[a-z]{2}$/;
// "czone.com.pk" → "Czone", "shop.galaxytech.pk" → "Galaxytech": the store name when the page names none.
export function storeNameFromUrl(url: string): string {
  const host = domainOf(url).replace(SECOND_LEVEL, "").replace(/\.[a-z]{2,}$/, "");
  const label = host.split(".").pop() ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

const GENERIC_STORE = /^(seller|shop|store|unknown|n\/?a|website|online store|olx seller|null)$/i;

// The store's name as the AI read it, unless it's blank, generic or just the web address
// ("toolcraft.pk", "paklap") — then the name comes from the website ("Toolcraft", "Paklap").
export function cleanStoreName(store: string | null | undefined, url: string): string {
  const s = (store ?? "").trim().slice(0, 60);
  const fromUrl = storeNameFromUrl(url);
  if (!s || GENERIC_STORE.test(s) || /^[\w-]+(\.[a-z]{2,})+$/i.test(s) || s === fromUrl.toLowerCase()) return fromUrl || s || "Store";
  return s;
}

// Used-goods marketplaces and classifieds, skipped unless the owner asked for used.
export const USED_MARKETPLACES = ["olx.com.pk", "facebook.com", "pakwheels.com"];
// Never a product page with a price we can link to.
export const NOT_SHOPS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "threads.com",
  "threads.net",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "reddit.com",
  "quora.com",
  "pinterest.com",
  "scribd.com",
  "wikipedia.org",
];

// Foreign marketplaces: no PKR prices, no delivery in Pakistan. alibaba.com also hosts SEO "price guides".
export const FOREIGN_MARKETS = ["alibaba.com", "aliexpress.com", "made-in-china.com", "indiamart.com", "ebay.com", "amazon.com", "microless.com", "justdial.com"];

const SIZE_UNITS =
  /^(kw|kva|kwh|w|watts?|hp|tons?|gb|tb|mah|ah|v|volts?|amps?|hz|inch(es)?|in|kg|mm|cm|ltrs?|lit(re|er)s?|cc|heads?|needles?|gen|generation|stage|phase|seater|cores?)$/;

function onDomain(url: string, domains: string[]): boolean {
  const d = domainOf(url);
  return domains.some((x) => d === x || d.endsWith(`.${x}`));
}

// Lowercase words for spec matching: punctuation → spaces, decimal points kept ("5.5 kw"),
// prices removed first so "Rs 285,000" never matches a "285" model number.
export function normalizeSpecText(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?<![a-z])(?:rs\.?|pkr|₨)\s*[\d,]+(?:\.\d+)?/g, " ")
    .replace(/\d{1,3}(?:,\d{2,3})+/g, " ")
    .replace(/(\d)\.(\d)/g, "$1\u0001$2")
    .replace(/[^a-z0-9\u0001]+/g, " ")
    .replace(/\u0001/g, ".")
    .replace(/(?<![a-z0-9])c(i[3579])(?![0-9])/g, "core $1") // Pakistani shops write "Ci7-13620H"
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A keyword as a regex over normalized text: spaces optional ("rtx4050" = "rtx 4050"), whole words only
// ("i9" never matches inside "i90"), model numbers may carry a short suffix ("14900" matches "14900k",
// "285" matches "285hx"), words may be plural.
function keywordPattern(keyword: string): string | null {
  const tokens = normalizeSpecText(keyword)
    .split(" ")
    .filter(Boolean)
    // "rtx4050" → "rtx", "4050" (letters of 2+ then digits); "i9" stays one token.
    .flatMap((t) => (/^[a-z]{2,}\d+$/.test(t) ? t.split(/(?<=[a-z])(?=\d)/) : [t]));
  if (!tokens.length) return null;
  const last = tokens[tokens.length - 1];
  const tail = /\d$/.test(last) ? "[a-z]{0,3}" : "(?:s|es)?";
  return `(?<![a-z0-9.])${tokens.map(escapeRe).join("\\s?")}${tail}(?![a-z0-9])`;
}

export function mentions(normalizedText: string, keyword: string): boolean {
  const p = keywordPattern(keyword);
  return p ? new RegExp(p).test(normalizedText) : false;
}

// "i9" → any "i<number>"; "rtx 4050" → any "rtx <number>"; "5 kw" → any "<number> kw"; "13th gen" → any
// "<n>th gen". A sibling that isn't one of the accepted keywords is a clear conflict ("i5", "rtx 3050").
function siblingPattern(keyword: string): RegExp | null {
  const k = normalizeSpecText(keyword);
  let m = /^([a-z][a-z ]*?) ?(\d+)$/.exec(k);
  if (m) return new RegExp(`(?<![a-z0-9.])${escapeRe(m[1]).replace(/ /g, "\\s?")}\\s?\\d+[a-z]{0,3}(?![a-z0-9])`, "g");
  m = /^(\d+(?:\.\d+)?)(st|nd|rd|th)? ?([a-z][a-z ]*)$/.exec(k);
  // Only real units ("5 kw", "100 kva", "13th gen"): "285k" or "285hx" are model numbers, not sizes.
  if (m && (m[2] || SIZE_UNITS.test(m[3]))) {
    const ord = m[2] ? "(?:st|nd|rd|th)" : "";
    return new RegExp(`(?<![a-z0-9.])\\d+(?:\\.\\d+)?${ord}\\s?${escapeRe(m[3]).replace(/ /g, "\\s?")}(?:s|es)?(?![a-z0-9])`, "g");
  }
  return null;
}

function conflictsIn(text: string, req: SpecRequirement): string[] {
  const found = new Set<string>();
  for (const k of req.noneOf ?? []) if (mentions(text, k)) found.add(normalizeSpecText(k));
  for (const k of req.anyOf) {
    const re = siblingPattern(k);
    if (!re) continue;
    for (const m of text.matchAll(re)) {
      if (!req.anyOf.some((a) => mentions(m[0], a))) found.add(m[0]);
    }
  }
  return [...found];
}

// Below this much text a missing spec means "couldn't check", not "doesn't match".
export const SHORT_TEXT_CHARS = 400;

export type RequirementCheck = { status: SpecStatus; missing: string[]; conflicts: string[] };

// Every must-have spec against the listing's own title and text (never the AI's opinion):
// - a spec the title contradicts (says "i5" but not "i9") or the text contradicts without mentioning it → mismatch;
// - every spec mentioned → matched;
// - otherwise unverified when the text is short, mismatch when a long page never mentions it.
export function checkRequirements(
  title: string,
  content: string,
  requirements: SpecRequirement[] | undefined,
  url?: string,
): RequirementCheck {
  const must = (requirements ?? []).filter((r) => r.mustHave && r.anyOf.length);
  if (!must.length) return { status: "matched", missing: [], conflicts: [] };
  // The product URL slug counts as part of the title ("...-rtx-4070-8gb" contradicts "RTX 4050").
  const t = normalizeSpecText(`${title} ${urlSlug(url)}`);
  const all = normalizeSpecText(`${title} ${content}`);
  const missing: string[] = [];
  const conflicts: string[] = [];
  for (const r of must) {
    const inTitle = r.anyOf.some((k) => mentions(t, k));
    const titleConflicts = inTitle ? [] : conflictsIn(t, r);
    if (titleConflicts.length) {
      conflicts.push(...titleConflicts);
      continue;
    }
    if (inTitle || r.anyOf.some((k) => mentions(all, k))) continue;
    const textConflicts = conflictsIn(all, r);
    if (textConflicts.length) conflicts.push(...textConflicts);
    else missing.push(r.label);
  }
  if (conflicts.length) return { status: "mismatch", missing, conflicts };
  if (!missing.length) return { status: "matched", missing, conflicts };
  return { status: all.length < SHORT_TEXT_CHARS ? "unverified" : "mismatch", missing, conflicts };
}

function urlSlug(url: string | undefined): string {
  if (!url) return "";
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/[-_/+.]+/g, " ");
  } catch {
    return "";
  }
}

// The AI's requirements, cleaned in code: lowercase keywords, no blanks or duplicates, sane sizes.
export function cleanRequirements(input: SpecRequirement[] | null | undefined): SpecRequirement[] {
  const words = (list: string[] | undefined, max: number) =>
    [...new Set((list ?? []).map((k) => normalizeSpecText(k)).filter((k) => k.length >= 2 && k.length <= 40))].slice(0, max);
  return (input ?? [])
    .map((r) => ({
      label: r.label.trim().slice(0, 40),
      mustHave: Boolean(r.mustHave),
      anyOf: words(r.anyOf, 14),
      noneOf: words(r.noneOf, 14),
    }))
    .filter((r) => r.label && r.anyOf.length)
    .slice(0, 6);
}

// "i9 + RTX 4050" for notes and the empty state.
export function requirementsLabel(requirements: SpecRequirement[] | undefined): string {
  return (requirements ?? [])
    .filter((r) => r.mustHave)
    .map((r) => r.label)
    .join(" + ");
}

// Why a URL is not a single product page, or null when it may be one. Search, category, collection,
// tag and brand pages list many products and their link never opens the listing the price came from.
export function listingUrlProblem(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "invalid link";
  }
  if (!/^https?:$/.test(u.protocol)) return "invalid link";
  if (onDomain(url, NOT_SHOPS)) return "video or social post";
  if (onDomain(url, FOREIGN_MARKETS)) return "foreign marketplace";
  let path = u.pathname.toLowerCase();
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep the raw path
  }
  if (path === "/" || path === "") return "home page";
  const q = u.searchParams;
  if (["q", "query", "s", "search", "k", "keyword", "keywords", "search_query", "text", "page", "sort", "orderby", "filter"].some((p) => q.has(p))) return "search page";
  if (/\/(search|searchresults?|find)(\/|$|\.)|\/(items\/)?q-|\/s\//.test(path)) return "search page";
  if (/_g\d+(\/|$)/.test(path)) return "search page"; // OLX location listings
  if (/\/(product-category|product-tag|category|categories|cat|tag|tags|brands?|manufacturer|department|catalog|catalogsearch)(\/|$)/.test(path)) {
    return "category page";
  }
  if (/\/collections\//.test(path) && !/\/products?\//.test(path)) return "category page";
  // Price lists: "/page/4", "/pricelist/…", "/laptops-prices/…", "/gaming-laptop-prices-in-pakistan".
  // (A single product's "…-price-in-pakistan" page is fine.)
  if (/\/page\/\d+\/?$|\/(pricelist|price-list|compare)\/|\/[a-z-]+-prices\/|\/[a-z-]+-prices(-in-pakistan)?(\.html)?\/?$/.test(path)) {
    return "category page";
  }
  if (/\/(shop|store|products|deals|sale|offers|compare|blog|blogs|news|articles?)\/?$/.test(path)) return "category page";
  if (/\/(blog|blogs|news|article|articles|tender|tenders)\//.test(path)) return "article";
  if (/\.(pdf|docx?|xlsx?)$/.test(path)) return "document";
  return null;
}

const USED_TITLE =
  /\b(used|second[\s-]?hand|2nd[\s-]?hand|refurb(?:ished)?|renewed|open[\s-]?box|pre[\s-]?owned|like[\s-]?new|slightly used|for parts|box open|10\/10 condition|9\/10 condition)\b/i;
const USED_TEXT =
  /\bcondition\s*[:-]?\s*(used|refurbished|renewed|open[\s-]?box|pre[\s-]?owned|second[\s-]?hand)\b|\b(this|the)\s+(item|unit|product|laptop|machine|device)\s+is\s+(used|refurbished|open[\s-]?box)\b|\bslightly used\b/i;

// Used, refurbished or open-box, as written in the listing ("Unused" and "used for gaming" don't count).
export function isUsedListing(title: string, content: string): boolean {
  return USED_TITLE.test(title) || USED_TEXT.test(content);
}

// More than this many different prices on one page → a list of products, not one listing.
export const MAX_PRICES_ON_PRODUCT_PAGE = 8;

export type ScreenDropped = { notListing: number; usedSite: number; used: number; noPrice: number; specMismatch: number };
export type ScreenedResult<R> = { result: R; specStatus: Exclude<SpecStatus, "mismatch">; missingSpecs: string[] };

// Code screen before the AI reads anything: only single product pages with a written PKR amount,
// new unless used was asked, and not contradicting a must-have spec.
export function screenResults<R extends { title: string; url: string; content: string }>(
  results: R[],
  opts: { requirements?: SpecRequirement[]; condition?: "new" | "used" },
): { kept: ScreenedResult<R>[]; dropped: ScreenDropped } {
  const dropped: ScreenDropped = { notListing: 0, usedSite: 0, used: 0, noPrice: 0, specMismatch: 0 };
  const kept: ScreenedResult<R>[] = [];
  const wantUsed = opts.condition === "used";
  for (const r of results) {
    if (listingUrlProblem(r.url)) {
      dropped.notListing++;
      continue;
    }
    if (!wantUsed && onDomain(r.url, USED_MARKETPLACES)) {
      dropped.usedSite++;
      continue;
    }
    if (!wantUsed && isUsedListing(r.title, r.content)) {
      dropped.used++;
      continue;
    }
    const amounts = new Set(parseAmounts(`${r.title}\n${r.content}`).map((a) => a.value));
    if (!amounts.size) {
      dropped.noPrice++;
      continue;
    }
    if (amounts.size > MAX_PRICES_ON_PRODUCT_PAGE) {
      dropped.notListing++;
      continue;
    }
    const check = checkRequirements(r.title, r.content, opts.requirements, r.url);
    if (check.status === "mismatch") {
      dropped.specMismatch++;
      continue;
    }
    kept.push({ result: r, specStatus: check.status, missingSpecs: check.missing });
  }
  return { kept, dropped };
}

// How much a URL looks like one product's page: 2 = shop product path ("/product/…", "/products/…",
// "-p.aspx", "-i123.html"), 1 = a long specific slug, 0 = probably a guide or list. Used only to choose
// which pages to open when the search snippet lacks the price or specs (never to accept a listing).
export function productPageScore(url: string): number {
  if (listingUrlProblem(url)) return 0;
  let path = "";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return 0;
  }
  if (/\/(product|products|p|item|items|dp|pd|listing)\/[^/]+|-p\.aspx$|-i\d+(-s\d+)?\.html$|\/\d{4,}[^/]*$/.test(path)) return 2;
  const last = path.split("/").filter(Boolean).pop() ?? "";
  if (/(guide|best|top-\d+|vs|how|what|why|review|benefits|20\d\d)/.test(last)) return 0;
  return last.split("-").length >= 4 ? 1 : 0;
}

// Results worth opening (Tavily Extract): product-looking pages whose snippet shows no price or
// leaves a spec unchecked. Best candidates first, at most `max`.
export function pickForExtract<R extends { title: string; url: string; content: string }>(
  results: R[],
  opts: { requirements?: SpecRequirement[]; condition?: "new" | "used" },
  max = 8,
): R[] {
  const wantUsed = opts.condition === "used";
  return results
    .map((r) => ({ r, score: productPageScore(r.url) }))
    .filter(({ r, score }) => {
      if (!score || (!wantUsed && (onDomain(r.url, USED_MARKETPLACES) || isUsedListing(r.title, r.content)))) return false;
      const noPrice = !hasMarkedPrice(`${r.title}\n${r.content}`);
      const check = checkRequirements(r.title, r.content, opts.requirements, r.url);
      // A title or URL that contradicts the specs is final; otherwise the full page can tell.
      if (check.conflicts.length && contradictsTitle(r, opts.requirements)) return false;
      return noPrice || check.status !== "matched";
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ r }) => r);
}

// A full page's text, cut down for reading: the top of the page (title, specs) plus the text around
// each PKR amount (prices usually sit below long menus). Nothing is rewritten, only selected.
export function pageExcerpt(text: string, max = 3500): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, 1500);
  const windows: string[] = [];
  let used = head.length;
  const re = /(?<![a-z])(?:rs\.?|pkr|₨)\s*\d[\d,]*/gi;
  let lastEnd = 1500;
  for (const m of flat.matchAll(re)) {
    const at = m.index ?? 0;
    if (at < lastEnd) continue;
    const start = Math.max(lastEnd, at - 250);
    const end = Math.min(flat.length, at + 150);
    const piece = flat.slice(start, end);
    if (used + piece.length + 5 > max) break;
    windows.push(piece);
    used += piece.length + 5;
    lastEnd = end;
  }
  return [head, ...windows].join(" […] ");
}

// A price marked as money ("Rs 3,34,999", "PKR 220,000", "26.5 lakh"); bare numbers like "13900" are
// often model numbers, so they don't count here.
export function hasMarkedPrice(text: string): boolean {
  // parseAmounts already ignores tiny amounts like a cart widget's "PKR 0.00".
  return parseAmounts(text).some((a) => /rs|pkr|rupee|lakh|lac|lkh|crore|cr\b|hazar|thousand/i.test(a.raw));
}

function contradictsTitle(r: { title: string; url: string }, requirements?: SpecRequirement[]): boolean {
  return checkRequirements(r.title, "", requirements, r.url).conflicts.length > 0;
}

export function describeScreenDropped(d: ScreenDropped, requirements?: SpecRequirement[]): string | null {
  const label = requirementsLabel(requirements);
  const parts = [
    d.specMismatch && `${d.specMismatch} not matching ${label || "your specs"}`,
    d.notListing && `${d.notListing} search or category page${d.notListing > 1 ? "s" : ""}`,
    (d.usedSite || d.used) && `${d.usedSite + d.used} used or refurbished`,
    d.noPrice && `${d.noPrice} without a PKR price`,
  ].filter(Boolean);
  const total = d.specMismatch + d.notListing + d.usedSite + d.used + d.noPrice;
  return total ? `${total} result${total > 1 ? "s" : ""} skipped: ${parts.join(", ")}.` : null;
}

// The one honest line shown when nothing is left.
export function emptyNeedNote(req: Pick<NeedRequest, "item" | "requirements" | "condition">): string {
  const what = requirementsLabel(req.requirements) || req.item;
  return `No ${req.condition === "used" ? "" : "new "}listings match ${what}. Try other words, paste a link you found, or upload a quotation.`;
}
