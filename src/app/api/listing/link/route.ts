// POST { url, qty?, requirements?, offerId? } → { option, offer, note? }.
// The owner pastes a product page they found. Tavily Extract (or a guarded fetch) gets the page text,
// the AI reads store / title / price / condition, and code checks the price is written on the page and
// the owner's specs (lib/linkReader.ts). Failures come back as { option: null, offer: null, note }.
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import { aiEnabled, aiJson } from "@/lib/ai";
import { buildLinkResult, checkLinkUrl, LINK_TEXT_CAP, linkPageProblem, type LinkResponse, safeFetchPage } from "@/lib/linkReader";
import { tavilyExtract } from "@/lib/search";
import { cleanRequirements } from "@/lib/sourcing";

export const maxDuration = 30;

const bodySchema = z.object({
  url: z.string().trim().min(4).max(2000),
  qty: z.number().int().min(1).max(1000).nullable().optional(),
  requirements: z
    .array(
      z.object({
        label: z.string().max(60),
        mustHave: z.boolean(),
        anyOf: z.array(z.string().max(60)).max(20),
        noneOf: z.array(z.string().max(60)).max(20).optional(),
      }),
    )
    .max(8)
    .nullable()
    .optional(),
  offerId: z
    .string()
    .max(80)
    .regex(/^[\w-]+$/)
    .nullable()
    .optional(),
});

const readSchema = z.object({
  store: z.string().nullable().describe("Shop or website brand name selling the product, or null"),
  title: z.string().nullable().describe("Product name as written on the page"),
  model: z.string().nullable().describe("Brand and model as written, or null"),
  pricePkr: z.number().int().nullable().describe("Current price of ONE unit in PKR exactly as written, or null. Do not estimate."),
  condition: z.enum(["new", "used", "refurbished", "unknown"]),
});

type Page = { title: string; text: string };
const pageCache = new Map<string, Page>(); // per server process: pasting the same link twice costs nothing

function fail(note: string, status = 200) {
  return Response.json({ option: null, offer: null, note } satisfies LinkResponse, { status });
}

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Paste the full link to a product page.", 400);

  const checked = checkLinkUrl(parsed.data.url);
  if (!checked.ok) return fail(checked.note, 400);
  const url = checked.url.toString();
  const pageProblem = linkPageProblem(url);
  if (pageProblem) return fail(pageProblem);

  let page = pageCache.get(url) ?? null;
  if (!page) {
    const extracted = await tavilyExtract(url);
    page = extracted ? { title: "", text: extracted.replace(/\s+\n/g, "\n").slice(0, LINK_TEXT_CAP) } : await safeFetchPage(checked.url);
    if (page && page.text.trim().length >= 40) {
      pageCache.set(url, page);
      if (pageCache.size > 100) pageCache.delete(pageCache.keys().next().value!);
    } else page = null;
  }
  if (!page) return fail("Couldn't open that page. Check the link, or enter the price yourself.");
  if (!aiEnabled()) return fail("Couldn't read that page automatically right now. Enter the price yourself.");

  const read = await aiJson(readSchema, {
    tier: "fast",
    maxTokens: 600,
    system:
      "You read one product page from a shop in Pakistan. Return the store (shop or website brand, never a person), the product " +
      "name, brand/model, the current price of ONE unit in PKR exactly as written (convert lakh exactly: 3.5 lakh = 350000; " +
      "ignore crossed-out old prices, monthly installments, deposits and prices in other currencies), and the condition " +
      "('used'/'refurbished' only if the page says so). If the page sells nothing or shows no PKR price, set pricePkr to null.",
    prompt: `URL: ${url}\nPage title: ${page.title || "(none)"}\n\nPage text:\n${page.text}`,
  });
  if (!read) return fail("Couldn't read that page right now. Try again, or enter the price yourself.");

  return Response.json(
    buildLinkResult({
      url,
      page,
      read,
      qty: parsed.data.qty ?? 1,
      requirements: cleanRequirements(parsed.data.requirements),
      offerId: parsed.data.offerId ?? null,
    }) satisfies LinkResponse,
  );
}
