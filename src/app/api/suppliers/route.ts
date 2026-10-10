// POST { item, model, city, excludeSupplier?, live? } → { suppliers: Supplier[] }.
// The demo machine (Jack F5) gets the fictional demo suppliers instantly, from no web call. Any other item gets no demo
// suppliers: with `live: true` and search + AI keys, up to three web-found dealers are returned (contact email =
// TEST_INBOX, so nothing reaches a real company); without keys the list is empty and the owner pastes replies instead.
import { apiUser } from "@/lib/auth/api";
import { z } from "zod";
import { aiEnabled, aiJson } from "@/lib/ai";
import { DEMO_ITEM, DEMO_MODEL } from "@/lib/demoData";
import { searchEnabled, webSearch } from "@/lib/search";
import { resolveDemoSuppliers, sameSupplier } from "@/lib/suppliers";
import type { Supplier } from "@/lib/types";

const dealerSchema = z.object({
  dealers: z.array(
    z.object({
      name: z.string(),
      phone: z.string().nullable(),
      city: z.string().nullable(),
      url: z.string(),
    }),
  ),
});

export async function POST(request: Request) {
  const authed = await apiUser(request);
  if (authed instanceof Response) return authed;
  const body = (await request.json().catch(() => ({}))) as {
    item?: string;
    model?: string;
    city?: string;
    excludeSupplier?: string;
    live?: boolean;
  };
  const exclude = body.excludeSupplier ?? "";
  const demo = isDemoMachine(body.item, body.model);
  let suppliers = demo ? resolveDemoSuppliers().filter((s) => !sameSupplier(s.name, exclude)) : [];

  if (!demo && body.live && searchEnabled() && aiEnabled() && process.env.TEST_INBOX) {
    const found = await withTimeout(findDealers(body.item || DEMO_ITEM, body.model || DEMO_MODEL, body.city), 12000);
    const fresh = (found ?? []).filter(
      (d) => !sameSupplier(d.name, exclude) && !suppliers.some((s) => sameSupplier(s.name, d.name)),
    );
    suppliers = [...suppliers, ...fresh.slice(0, 3)];
  }

  return Response.json({ suppliers });
}

// The cached demo path: the Jack F5 (or a request with no item at all).
function isDemoMachine(item?: string, model?: string): boolean {
  const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!norm(item) && !norm(model)) return true;
  return norm(model).includes(norm(DEMO_MODEL)) || (!norm(model) && norm(item) === norm(DEMO_ITEM));
}

async function findDealers(item: string, model: string, city?: string): Promise<Supplier[]> {
  const results = await webSearch(`${model} ${item} dealer ${city ?? ""} Pakistan contact`);
  if (!results.length) return [];
  const out = await aiJson(dealerSchema, {
    system:
      "From these search results, list machine dealers or distributors in Pakistan that sell the item. " +
      "Use only names, phones and cities printed in the results; null if not printed. Skip marketplaces and manufacturers' global sites.",
    prompt: `Item: ${model} (${item})\n\n${results.map((r) => `${r.title}\nURL: ${r.url}\n${r.content}`).join("\n\n")}`,
    maxTokens: 2000,
  });
  return (out?.dealers ?? []).map((d) => ({
    name: d.name,
    email: process.env.TEST_INBOX ?? "",
    phone: d.phone,
    city: d.city,
    link: d.url,
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}
