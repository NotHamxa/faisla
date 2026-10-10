// POST /api/extract — quotation photo/PDF → Quotation draft for the confirm screen.
// Accepts multipart form-data with `file`, or JSON { demo: true }. The AI only copies what is printed;
// checkArithmetic (code) flags anything that doesn't add up.
import { normalizeIban } from "@/lib/fraud";
import { z } from "zod";
import { aiEnabled, aiJson, type ImageInput } from "@/lib/ai";
import { demoQuotation } from "@/lib/demoData";
import { checkArithmetic } from "@/lib/quotation";
import type { NeedsOwnerInput, Quotation } from "@/lib/types";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

const MEDIA_TYPES: Record<string, ImageInput["mediaType"]> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
};

// Mirrors Quotation. Plain types only (structured outputs); integers and dates are cleaned in code.
const money = z.number().nullable();
const extractionSchema = z.object({
  supplierName: z.string().describe("Company name on the letterhead"),
  supplierPhone: z.string().nullable(),
  supplierEmail: z.string().nullable(),
  quoteDate: z.string().nullable().describe("Quotation date as YYYY-MM-DD"),
  items: z.array(
    z.object({
      description: z.string().describe("Short item name, without the spec details"),
      model: z.string().nullable().describe("Brand and model number, e.g. JUKI AMS-221F"),
      qty: z.number(),
      unitPrice: z.number().describe("Price per unit in PKR, as printed"),
      lineTotal: money.describe("Line amount in PKR as printed; null if not printed"),
    }),
  ),
  printedTotal: money.describe("Grand total in PKR as printed; null if not printed"),
  cashDiscountPct: z.number().nullable().describe("Cash/full-payment discount in percent, 8 for 8%"),
  installmentMonths: z.number().nullable().describe("Number of monthly installments"),
  installmentAmount: money.describe("Amount of each installment in PKR"),
  firstInstallmentOnDelivery: z
    .boolean()
    .nullable()
    .describe("true if the first installment is due on delivery/order, false if one month after delivery, null if not stated"),
  markupClaimedPct: z.number().nullable().describe('Markup/interest the supplier claims for installments, 0 for "0% markup"'),
  validityDays: z.number().nullable().describe("How many days the quotation is valid"),
  bankName: z.string().nullable().describe("Bank name in the payment/bank details, or null"),
  accountTitle: z.string().nullable().describe("Account title in the bank details, exactly as printed, or null"),
  iban: z.string().nullable().describe("IBAN exactly as printed (e.g. PK76 MEZN 0002 3101 0456 7890), or null"),
});

type Extraction = z.infer<typeof extractionSchema>;

const SYSTEM = `You read supplier quotations for Pakistani small businesses. Quotations may be photos, scans or PDFs, in English, Urdu or a mix (Roman Urdu included).
Extract the quotation into this JSON. Use null for anything not printed. Never compute totals; copy numbers exactly as printed. Amounts in PKR as integers.
Rules:
- Convert lakh/crore words to plain integers: "15 lakh" = 1500000, "13.4 lakh" = 1340000, "1 crore" = 10000000. "Rs 15,00,000" = 1500000.
- Urdu words: "qist"/"اقساط" = installments, "maah"/"ماہ" = month, "din"/"دن" = days, "naqad"/"نقد" = cash.
- Never fill a field by calculating it from other fields. If the line total or grand total is not printed, use null.
- Percentages as plain numbers: 8% → 8. "0% markup" or "interest free" → markupClaimedPct 0.
- Validity: "valid for 15 days" → 15; "2 weeks" → 14.
- Dates as YYYY-MM-DD (08-Oct-2026 → 2026-10-08).
- Bank details: copy bank name, account title and IBAN exactly as printed (character by character); null if absent.`;

const PROMPT = "Extract this supplier quotation into the JSON schema.";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { demo?: unknown } | null;
    if (body?.demo === true) return demoResponse();
    return Response.json({ error: "Send a quotation file, or { demo: true }." }, { status: 400 });
  }

  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Send the quotation as multipart form-data with a `file` field." }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file received. Choose a photo or PDF of the quotation." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File is larger than 10 MB. Try a smaller photo." }, { status: 413 });
  }
  const mediaType = MEDIA_TYPES[file.type.toLowerCase()];
  if (!mediaType) {
    return Response.json(
      { error: `Can't read ${file.type || "this file type"}. Upload a JPG, PNG, WebP or PDF.` },
      { status: 415 },
    );
  }

  // No key configured (or DEMO_MODE=1): keep the demo moving with the demo quotation.
  if (!aiEnabled()) return demoResponse();

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const extracted = await aiJson(extractionSchema, {
    system: SYSTEM,
    prompt: PROMPT,
    images: [{ mediaType, base64 }],
  });

  if (!extracted) {
    return needsOwnerInput("The AI couldn't read this quotation reliably. Please type the details from the paper.");
  }
  const quotation = clean(extracted);
  if (quotation.items.length === 0) {
    return needsOwnerInput("The AI didn't find any items with a price on this page. Please type the details from the paper.");
  }
  return Response.json({ quotation, issues: checkArithmetic(quotation), source: "ai" });
}

function demoResponse() {
  return Response.json({ quotation: demoQuotation, issues: checkArithmetic(demoQuotation), source: "demo" });
}

function needsOwnerInput(reason: string) {
  const body: NeedsOwnerInput = { needsOwnerInput: true, reason };
  return Response.json(body);
}

// Schema-valid model output → Quotation with integer rupees, sane dates and no empty strings.
function clean(x: Extraction): Quotation {
  return {
    supplierName: x.supplierName.trim(),
    supplierPhone: text(x.supplierPhone),
    supplierEmail: text(x.supplierEmail),
    quoteDate: x.quoteDate && /^\d{4}-\d{2}-\d{2}$/.test(x.quoteDate.trim()) ? x.quoteDate.trim() : null,
    items: x.items
      .filter((item) => item.unitPrice > 0 || item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        model: text(item.model),
        qty: Math.max(0, Math.round(item.qty)),
        unitPrice: Math.round(item.unitPrice),
        lineTotal: rupees(item.lineTotal),
      })),
    printedTotal: rupees(x.printedTotal),
    cashDiscountPct: finite(x.cashDiscountPct),
    installmentMonths: wholeNumber(x.installmentMonths),
    installmentAmount: rupees(x.installmentAmount),
    firstInstallmentOnDelivery: x.firstInstallmentOnDelivery,
    markupClaimedPct: finite(x.markupClaimedPct),
    validityDays: wholeNumber(x.validityDays),
    bankName: text(x.bankName),
    accountTitle: text(x.accountTitle),
    iban: x.iban && x.iban.trim() ? normalizeIban(x.iban) : null, // the fraud check validates the checksum
  };
}

function text(s: string | null): string | null {
  const t = s?.trim();
  return t ? t : null;
}

function finite(n: number | null): number | null {
  return n !== null && Number.isFinite(n) ? n : null;
}

function rupees(n: number | null): number | null {
  const v = finite(n);
  return v === null ? null : Math.round(v);
}

function wholeNumber(n: number | null): number | null {
  const v = finite(n);
  return v === null || v <= 0 ? null : Math.round(v);
}
