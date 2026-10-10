// Supplier reply reading (spec §7.5). AI extracts price and terms from the email; a deterministic
// Roman-Urdu/lakh parser is the fallback when AI is unavailable, and also cross-checks the AI's price
// against the amounts actually written in the email. Prices that can't be pinned down → null + owner.
import { z } from "zod";
import { aiJson } from "./ai";
import { formatLakh } from "./format";
import type { Offer } from "./types";

export type ReplyExtraction = {
  unitPrice: number | null;
  total: number | null;
  qty: number | null;
  deliveryDays: number | null;
  warrantyMonths: number | null;
  paymentTerms: string | null;
  summary: string;
  source: "ai" | "parser";
  needsOwnerInput?: string; // set when unitPrice is null
};

export type ParsedAmount = { value: number; kind: "unit" | "total" | "unknown"; raw: string };

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  panch: 5, paanch: 5, five: 5, chhe: 6, che: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8,
  nau: 9, nine: 9, das: 10, ten: 10, barah: 12, twelve: 12, pandrah: 15, fifteen: 15, bees: 20, twenty: 20,
};
const UNIT_WORDS =
  "saal|sal|years?|yrs?|mahin[ae]|months?|din|days?|haft[ae]|weeks?|machines?|units?|pcs|pieces";

// "per unit", "each", "fi machine", "har machine", "rate", "/unit", "unit price". ("for 4 units" is not per unit.)
const UNIT_MARKER = /\b(per|each|fi|har|rate|apiece)\b|\/\s*(unit|machine|pcs?|piece)\b|\bunit\s*price\b/;
const TOTAL_MARKER = /\b(total|kul|sab|all|overall|grand|altogether|mila\s*ke)\b/;

// Lowercase, number words → digits (only before a unit: "ek saal" → "1 saal"), phone numbers masked.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\+92[\d\s-]{9,14}\d|\b0\d{3}[\s-]?\d{7}\b|\b0\d{2}[\s-]\d{3,4}[\s-]?\d{4}\b/g, " ")
    .replace(new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join("|")})\\s+(?=(${UNIT_WORDS})\\b)`, "g"), (_, w: string) => `${NUMBER_WORDS[w]} `)
    .replace(/[×]/g, " x ");
}

// Clauses split on commas, semicolons, newlines and sentence ends; not inside "13,40,000",
// decimal points ("13.4") or "Rs.".
function clauses(text: string): string[] {
  return text
    .split(/(?<!\d),|,(?!\d)|[;\n!?]|(?<!\brs)\.(?!\d)|\s-\s/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

function classify(clause: string, start: number, end: number): ParsedAmount["kind"] {
  const after = clause.slice(end, end + 22);
  const before = clause.slice(Math.max(0, start - 25), start);
  if (UNIT_MARKER.test(after)) return "unit";
  if (TOTAL_MARKER.test(after)) return "total";
  if (TOTAL_MARKER.test(before)) return "total";
  if (UNIT_MARKER.test(before) || /\b(1|ek)\s+(machine|unit|piece)\b/.test(before)) return "unit";
  return "unknown";
}

// Every PKR amount written in the text: "13.4 lakh", "1.2 crore", "Rs 13,40,000", "1340000/-".
export function parseAmounts(text: string): ParsedAmount[] {
  const out: ParsedAmount[] = [];
  for (const clause of clauses(normalize(text))) {
    let masked = clause;
    const take = (re: RegExp, toValue: (m: RegExpExecArray) => number) => {
      for (const m of masked.matchAll(re)) {
        const value = Math.round(toValue(m as RegExpExecArray));
        const start = m.index ?? 0;
        const end = start + m[0].length;
        if (value >= 1000) out.push({ value, kind: classify(clause, start, end), raw: m[0].trim() });
        masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
      }
    };
    take(/(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|lkh)\b/g, (m) => parseFloat(m[1]) * 1_00_000);
    take(/(?:rs\.?|pkr)?\s*(\d+(?:\.\d+)?)\s*(crores?|cr)\b/g, (m) => parseFloat(m[1]) * 1_00_00_000);
    take(/(?:rs\.?|pkr|rupees?)\s*:?\s*(\d[\d,]*(?:\.\d+)?)(?:\s*\/-)?/g, (m) => parseFloat(m[1].replace(/,/g, "")));
    take(/(?<![\d.])(\d{1,3}(?:,\d{2,3})+|\d{5,})(?:\s*\/-)?(?![\d.])/g, (m) => {
      const v = parseFloat(m[1].replace(/,/g, ""));
      return v >= 10_000 ? v : 0;
    });
  }
  return out;
}

function parseQty(text: string): number | null {
  const re = /(?<!per\s|har\s|fi\s|each\s)\b(\d{1,3})\s*(?:x\s*)?(machines?|units?|pcs|pieces|nos|sets?)\b/;
  const m = re.exec(normalize(text));
  return m ? parseInt(m[1], 10) : null;
}

// Durations in a clause that mentions the keyword: "delivery 10 din", "2 hafte mein delivery".
// Picks the duration of the right kind nearest the keyword ("1 saal warranty aur delivery 10 din").
const DURATION = /(\d+)(?:\s*(?:-|to|se)\s*(\d+))?\s*(din|days?|haft[ae]|weeks?|mahin[ae]|months?|saal|sal|years?|yrs?)\b/g;

function parseDuration(text: string, keyword: RegExp, unit: "days" | "months"): number | null {
  const allowed = unit === "days" ? /^(din|day|haft|week|mahin|month)/ : /^(saal|sal|year|yr|mahin|month)/;
  for (const clause of clauses(normalize(text))) {
    const k = keyword.exec(clause);
    if (!k) continue;
    let best: { value: number; distance: number } | null = null;
    for (const m of clause.matchAll(DURATION)) {
      const u = m[3];
      if (!allowed.test(u)) continue;
      const n = parseInt(m[2] ?? m[1], 10); // ranges: take the longer end
      const days = /^(din|day)/.test(u) ? n : /^(haft|week)/.test(u) ? n * 7 : n * 30;
      const months = /^(saal|sal|year|yr)/.test(u) ? n * 12 : n;
      const distance = Math.abs((m.index ?? 0) - k.index);
      if (!best || distance < best.distance) best = { value: unit === "days" ? days : months, distance };
    }
    if (best) return best.value;
  }
  return null;
}

function parsePaymentTerms(original: string): string | null {
  const parts = clauses(original).filter((c) =>
    /\b(cash|advance|adv|installments?|instalments?|qist|aqsa+t|credit|cheque|payment|udhaar|udhar)\b/i.test(c),
  );
  return parts.length ? parts.slice(0, 2).join("; ") : null;
}

// Deterministic reader. referenceUnitPrice (the quotation's unit price) only decides whether an
// unlabelled amount is a unit price or a total; it never becomes the price itself.
export function parseReplyText(
  text: string,
  opts: { referenceUnitPrice?: number | null } = {},
): ReplyExtraction {
  const amounts = parseAmounts(text);
  const qty = parseQty(text);
  const deliveryDays = parseDuration(text, /deliver|supply|dispatch|pohanch|mil\s*jaye|ready/, "days");
  const warrantyMonths = parseDuration(text, /warrant|guarant|garant|wrnty/, "months");
  const paymentTerms = parsePaymentTerms(text);
  const ref = opts.referenceUnitPrice ?? null;
  const near = (v: number) => ref != null && v >= 0.5 * ref && v <= 2 * ref;

  let unitPrice = amounts.find((a) => a.kind === "unit")?.value ?? null;
  let total = amounts.find((a) => a.kind === "total")?.value ?? null;
  let reason: string | undefined;

  const unknown = amounts.filter((a) => a.kind === "unknown");
  if (unitPrice == null && total == null && unknown.length === 1) {
    const v = unknown[0].value;
    if (ref != null) {
      if (near(v)) unitPrice = v;
      else if (qty && near(v / qty)) total = v;
    } else if (!qty || qty === 1) {
      unitPrice = v; // a single price with no quantity is a unit price
    }
    if (unitPrice == null && total == null) reason = `Unclear whether ${unknown[0].raw} is per unit or the total.`;
  } else if (unitPrice == null && total == null && unknown.length > 1) {
    reason = `Several amounts (${unknown.map((a) => a.raw).join(", ")}) and none is marked per unit or total.`;
  }
  if (unitPrice == null && total != null && qty) unitPrice = Math.round(total / qty);
  if (unitPrice == null && total != null && !qty) reason = "Total price given but no quantity.";
  if (unitPrice == null && !reason) reason = "No price found in the reply.";

  const extraction: ReplyExtraction = {
    unitPrice,
    total,
    qty,
    deliveryDays,
    warrantyMonths,
    paymentTerms,
    summary: "",
    source: "parser",
    ...(unitPrice == null ? { needsOwnerInput: reason } : {}),
  };
  extraction.summary = summarize(extraction, /\bfinal\b/i.test(text));
  return extraction;
}

function summarize(x: ReplyExtraction, final: boolean): string {
  if (x.unitPrice == null) return `Price unclear: ${x.needsOwnerInput ?? "no price found"}`;
  const parts = [
    `${x.qty ? `${x.qty} machines at ` : ""}Rs ${formatLakh(x.unitPrice, 2)} each${final ? ", final price" : ""}`,
    x.deliveryDays != null && `delivery in ${x.deliveryDays} days`,
    x.warrantyMonths != null && `${x.warrantyMonths}-month warranty`,
    x.paymentTerms && `terms: ${x.paymentTerms}`,
  ].filter(Boolean);
  return parts.join("; ") + ".";
}

const aiReplySchema = z.object({
  unitPrice: z.number().int().nullable(),
  total: z.number().int().nullable(),
  qty: z.number().int().nullable(),
  deliveryDays: z.number().int().nullable(),
  warrantyMonths: z.number().int().nullable(),
  paymentTerms: z.string().nullable(),
  summary: z.string(),
});

// AI first, checked against the parser; parser alone when AI is unavailable.
export async function extractReply(input: {
  subject?: string;
  body: string;
  referenceUnitPrice?: number | null;
}): Promise<ReplyExtraction> {
  const text = stripQuoted(input.body);
  const parsed = parseReplyText(text, { referenceUnitPrice: input.referenceUnitPrice });
  const ai = await aiJson(aiReplySchema, {
    system:
      "You read supplier emails for a Pakistani garment factory. Replies are often in Roman Urdu " +
      '("13.4 lakh per unit" = 1340000; "1 saal" = 12 months; "10 din" = 10 days; "2 hafte" = 14 days). ' +
      "From this supplier email, extract: unit_price (PKR integer or null), total (or null), qty, delivery_days, " +
      "warranty_months, payment_terms, and a one-line summary in English. " +
      "If the price is unclear, set it to null and explain in summary. Never compute a total that is not written.",
    prompt: `Subject: ${input.subject ?? ""}\n\n${text}`,
    maxTokens: 1500,
  });
  if (!ai) return parsed;

  // Cross-check: the AI's unit price must be an amount written in the email (or a written total ÷ qty).
  const written = parseAmounts(text).map((a) => a.value);
  const qty = ai.qty ?? parsed.qty;
  const matchesText = (v: number) =>
    written.length === 0 || written.some((w) => Math.abs(w - v) <= 1 || (qty ? Math.abs(w / qty - v) <= 1 : false));
  const aiPriceOk = ai.unitPrice != null && ai.unitPrice > 0 && matchesText(ai.unitPrice);
  const unitPrice = aiPriceOk ? ai.unitPrice : parsed.unitPrice;

  const merged: ReplyExtraction = {
    unitPrice,
    total: ai.total ?? parsed.total,
    qty,
    deliveryDays: ai.deliveryDays ?? parsed.deliveryDays,
    warrantyMonths: ai.warrantyMonths ?? parsed.warrantyMonths,
    paymentTerms: ai.paymentTerms ?? parsed.paymentTerms,
    summary: ai.summary || parsed.summary,
    source: aiPriceOk || unitPrice == null ? "ai" : "parser",
  };
  if (unitPrice == null) merged.needsOwnerInput = ai.summary || parsed.needsOwnerInput || "Price unclear.";
  return merged;
}

// Drop the quoted original (our RFQ) below "On ... wrote:" or ">" lines, so its numbers aren't read.
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From: .+/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim() || text.trim();
}

// Small stable hash for offer/email ids (djb2, base36).
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function buildReplyOffer(
  x: ReplyExtraction,
  ctx: {
    key: string; // stable per reply (message id or from+subject+body)
    supplierName: string;
    supplierEmail: string | null;
    item: string;
    model: string | null;
    defaultQty: number;
    receivedAt: string;
  },
): Offer | null {
  if (x.unitPrice == null || x.unitPrice <= 0) return null;
  const qty = x.qty && x.qty > 0 ? x.qty : ctx.defaultQty;
  return {
    id: `offer-email-${hashString(ctx.key)}`,
    supplierName: ctx.supplierName,
    supplierEmail: ctx.supplierEmail,
    item: ctx.item,
    model: ctx.model,
    qty,
    unitPrice: x.unitPrice,
    total: qty * x.unitPrice,
    cashDiscountPct: null,
    installmentMonths: null,
    installmentAmount: null,
    firstInstallmentOnDelivery: false,
    source: "email",
    sourceLink: null,
    receivedAt: ctx.receivedAt,
    deliveryDays: x.deliveryDays,
    warrantyMonths: x.warrantyMonths,
    summary: x.summary,
  };
}
